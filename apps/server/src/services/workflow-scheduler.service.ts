import type { ScheduleConfig } from '@eous/nodes/types'
import {
  listPublishedWorkflowTriggerTargets,
  triggerPublishedWorkflow,
} from './workflow-trigger.service.js'
import { setRedisOnce } from '../lib/redis.js'

interface ZonedDateParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  weekday: number
}

const DEFAULT_TIMEZONE = 'Asia/Shanghai'
const firedSlots = new Map<string, string>()
let schedulerTimer: NodeJS.Timeout | null = null

function normalizeSchedule(value: unknown): ScheduleConfig | null {
  if (!value || typeof value !== 'object') return null
  const schedule = value as Partial<ScheduleConfig>
  if (
    schedule.mode === 'interval' ||
    schedule.mode === 'daily' ||
    schedule.mode === 'weekly' ||
    schedule.mode === 'monthly' ||
    schedule.mode === 'cron'
  ) {
    return schedule as ScheduleConfig
  }
  return null
}

function getZonedParts(now: Date, timezone: string): ZonedDateParts | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
      hour12: false,
    })
    const parts = Object.fromEntries(
      formatter.formatToParts(now).map((part) => [part.type, part.value]),
    )
    const weekdayMap: Record<string, number> = {
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
      Sun: 7,
    }
    const hour = Number(parts.hour)
    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: hour === 24 ? 0 : hour,
      minute: Number(parts.minute),
      weekday: weekdayMap[parts.weekday] ?? 7,
    }
  } catch {
    return null
  }
}

function parseTime(time: string): { hour: number; minute: number } | null {
  const match = time.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return { hour, minute }
}

function dayOfYear(parts: ZonedDateParts): number {
  const start = Date.UTC(parts.year, 0, 1)
  const current = Date.UTC(parts.year, parts.month - 1, parts.day)
  return Math.floor((current - start) / 86_400_000) + 1
}

function matchesNumberField(field: string, value: number): boolean {
  if (field === '*') return true
  return field.split(',').some((part) => {
    const trimmed = part.trim()
    const stepMatch = trimmed.match(/^\*\/(\d+)$/)
    if (stepMatch) {
      const step = Number(stepMatch[1])
      return step > 0 && value % step === 0
    }
    const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/)
    if (rangeMatch) {
      const start = Number(rangeMatch[1])
      const end = Number(rangeMatch[2])
      return value >= start && value <= end
    }
    return Number(trimmed) === value
  })
}

function matchesCron(cron: string, parts: ZonedDateParts): boolean {
  const fields = cron.trim().split(/\s+/)
  if (fields.length !== 5) return false
  const [minute, hour, day, month, weekday] = fields
  const cronWeekday = parts.weekday === 7 ? 0 : parts.weekday
  const weekdayMatches =
    weekday === '7' ? parts.weekday === 7 : matchesNumberField(weekday, cronWeekday)
  return (
    matchesNumberField(minute, parts.minute) &&
    matchesNumberField(hour, parts.hour) &&
    matchesNumberField(day, parts.day) &&
    matchesNumberField(month, parts.month) &&
    weekdayMatches
  )
}

function isScheduleDue(schedule: ScheduleConfig, now: Date): boolean {
  const timezone = schedule.timezone || DEFAULT_TIMEZONE
  const parts = getZonedParts(now, timezone)
  if (!parts) return false

  if (schedule.mode === 'interval') {
    const every = Math.max(1, Math.floor(schedule.every || 1))
    const totalMinutes = parts.hour * 60 + parts.minute
    if (schedule.unit === 'hour') return parts.minute === 0 && parts.hour % every === 0
    if (schedule.unit === 'day')
      return parts.hour === 0 && parts.minute === 0 && dayOfYear(parts) % every === 0
    return totalMinutes % every === 0
  }

  if (schedule.mode === 'daily') {
    const time = parseTime(schedule.time)
    return Boolean(time && parts.hour === time.hour && parts.minute === time.minute)
  }

  if (schedule.mode === 'weekly') {
    const time = parseTime(schedule.time)
    return Boolean(
      time &&
      schedule.weekdays.includes(parts.weekday) &&
      parts.hour === time.hour &&
      parts.minute === time.minute,
    )
  }

  if (schedule.mode === 'monthly') {
    const time = parseTime(schedule.time)
    return Boolean(
      time &&
      schedule.days.includes(parts.day) &&
      parts.hour === time.hour &&
      parts.minute === time.minute,
    )
  }

  return matchesCron(schedule.cron, parts)
}

function slotKey(now: Date): string {
  return now.toISOString().slice(0, 16)
}

async function claimScheduleSlot(
  workflowId: string,
  nodeId: string,
  slot: string,
): Promise<boolean> {
  const redisKey = `workflow:schedule:${workflowId}:${nodeId}:${slot}`
  const claimed = await setRedisOnce(redisKey, 120)
  if (claimed !== null) return claimed

  const localKey = `${workflowId}:${nodeId}`
  if (firedSlots.get(localKey) === slot) return false
  firedSlots.set(localKey, slot)
  return true
}

async function schedulerTick(now = new Date()) {
  const targets = await listPublishedWorkflowTriggerTargets('trigger.schedule')
  const slot = slotKey(now)

  for (const target of targets) {
    const schedule = normalizeSchedule(target.triggerNode.data.schedule)
    if (!schedule || !isScheduleDue(schedule, now)) continue

    const claimed = await claimScheduleSlot(target.workflow.id, target.triggerNode.id, slot)
    if (!claimed) continue

    void triggerPublishedWorkflow({
      workflow: target.workflow,
      definition: target.definition,
      triggerNodeId: target.triggerNode.id,
      triggerKind: 'cron',
      input: { scheduledAt: now.toISOString() },
    }).catch((error) => {
      console.error(
        `[workflow-scheduler] failed workflow=${target.workflow.id} node=${target.triggerNode.id}`,
        error,
      )
    })
  }
}

function startWorkflowScheduler() {
  if (schedulerTimer) return
  schedulerTimer = setInterval(() => {
    void schedulerTick()
  }, 30_000)
  schedulerTimer.unref?.()
  void schedulerTick()
}

export { schedulerTick, startWorkflowScheduler }
