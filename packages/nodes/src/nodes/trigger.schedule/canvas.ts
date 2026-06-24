import type { NodeCanvasViewInput, ScheduleConfig } from '../../types'
import { def, defaultSchedule } from './def'

const MODE_LABEL: Record<ScheduleConfig['mode'], string> = {
  interval: '每隔多久',
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  cron: 'Cron',
}

function isScheduleConfig(value: unknown): value is ScheduleConfig {
  if (!value || typeof value !== 'object') return false
  const mode = (value as { mode?: unknown }).mode
  return (
    mode === 'interval' ||
    mode === 'daily' ||
    mode === 'weekly' ||
    mode === 'monthly' ||
    mode === 'cron'
  )
}

function formatSchedule(schedule: ScheduleConfig): string {
  if (schedule.mode === 'interval') {
    const unitLabel = schedule.unit === 'hour' ? '小时' : schedule.unit === 'day' ? '天' : '分钟'
    return `每隔 ${schedule.every || 1} ${unitLabel}`
  }
  if (schedule.mode === 'weekly') {
    return `周 ${schedule.weekdays.join(',') || '--'} ${schedule.time}`
  }
  if (schedule.mode === 'monthly') {
    return `${schedule.days.join(',') || '--'} 日 ${schedule.time}`
  }
  if (schedule.mode === 'cron') return schedule.cron || '--'
  return schedule.time
}

function getCanvasView({ data }: NodeCanvasViewInput) {
  const schedule = isScheduleConfig(data.schedule) ? data.schedule : defaultSchedule
  const label = typeof data.label === 'string' ? data.label : def.meta.label
  const color = typeof data.color === 'string' ? data.color : undefined

  return {
    icon: def.meta.icon,
    title: label,
    color,
    rows: [
      { label: 'Mode', value: MODE_LABEL[schedule.mode] },
      { label: 'Rule', value: formatSchedule(schedule) },
      { label: 'TZ', value: schedule.timezone },
    ],
  }
}

export { getCanvasView }
