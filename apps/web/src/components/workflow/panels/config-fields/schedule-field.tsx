import { useCallback } from 'react'
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from '@eous/ui'
import type { ParamDef, ScheduleConfig } from '@eous/nodes'

interface ScheduleFieldProps {
  param: ParamDef
  value: unknown
  onChange: (value: unknown) => void
}

const TIMEZONES = [
  { label: 'Asia/Shanghai', value: 'Asia/Shanghai' },
  { label: 'UTC', value: 'UTC' },
  { label: 'America/New_York', value: 'America/New_York' },
  { label: 'America/Los_Angeles', value: 'America/Los_Angeles' },
  { label: 'Europe/London', value: 'Europe/London' },
  { label: 'Europe/Berlin', value: 'Europe/Berlin' },
  { label: 'Asia/Tokyo', value: 'Asia/Tokyo' },
  { label: 'Asia/Singapore', value: 'Asia/Singapore' },
]

const WEEKDAYS = [
  { label: '一', value: 1 },
  { label: '二', value: 2 },
  { label: '三', value: 3 },
  { label: '四', value: 4 },
  { label: '五', value: 5 },
  { label: '六', value: 6 },
  { label: '日', value: 7 },
]

const MONTH_DAYS = Array.from({ length: 31 }, (_, index) => index + 1)

function defaultSchedule(param: ParamDef): ScheduleConfig {
  const fallback: ScheduleConfig = {
    mode: 'daily',
    time: '09:00',
    timezone: 'Asia/Shanghai',
  }
  if (!param.default || typeof param.default !== 'object') return fallback
  return normalizeSchedule(param.default, fallback)
}

function normalizeSchedule(value: unknown, fallback?: ScheduleConfig): ScheduleConfig {
  const defaultValue =
    fallback ??
    ({
      mode: 'daily',
      time: '09:00',
      timezone: 'Asia/Shanghai',
    } satisfies ScheduleConfig)

  if (!value || typeof value !== 'object') return defaultValue
  const schedule = value as Partial<ScheduleConfig>
  const timezone =
    typeof schedule.timezone === 'string' && schedule.timezone ? schedule.timezone : 'Asia/Shanghai'

  if (schedule.mode === 'interval') {
    return {
      mode: 'interval',
      every:
        typeof schedule.every === 'number' && Number.isFinite(schedule.every)
          ? Math.max(1, Math.floor(schedule.every))
          : 15,
      unit:
        schedule.unit === 'hour' || schedule.unit === 'day' || schedule.unit === 'minute'
          ? schedule.unit
          : 'minute',
      timezone,
    }
  }
  if (schedule.mode === 'weekly') {
    return {
      mode: 'weekly',
      weekdays: Array.isArray(schedule.weekdays) ? schedule.weekdays : [1],
      time: typeof schedule.time === 'string' ? schedule.time : '09:00',
      timezone,
    }
  }
  if (schedule.mode === 'monthly') {
    return {
      mode: 'monthly',
      days: Array.isArray(schedule.days) ? schedule.days : [1],
      time: typeof schedule.time === 'string' ? schedule.time : '09:00',
      timezone,
    }
  }
  if (schedule.mode === 'cron') {
    return {
      mode: 'cron',
      cron: typeof schedule.cron === 'string' ? schedule.cron : '0 9 * * *',
      timezone,
    }
  }
  return {
    mode: 'daily',
    time:
      typeof (value as Record<string, unknown>).time === 'string'
        ? String((value as Record<string, unknown>).time)
        : '09:00',
    timezone,
  }
}

function getTimezone(schedule: ScheduleConfig) {
  return schedule.timezone || 'Asia/Shanghai'
}

function withTimezone<T extends ScheduleConfig>(schedule: T, timezone: string): T {
  return { ...schedule, timezone } as T
}

function ScheduleField({ param, value, onChange }: ScheduleFieldProps) {
  const schedule = normalizeSchedule(value, defaultSchedule(param))

  const commit = useCallback((next: ScheduleConfig) => onChange(next), [onChange])

  const setMode = useCallback(
    (mode: ScheduleConfig['mode']) => {
      const timezone = getTimezone(schedule)
      if (mode === 'interval') commit({ mode, every: 15, unit: 'minute', timezone })
      if (mode === 'daily') commit({ mode, time: '09:00', timezone })
      if (mode === 'weekly') commit({ mode, weekdays: [1], time: '09:00', timezone })
      if (mode === 'monthly') commit({ mode, days: [1], time: '09:00', timezone })
      if (mode === 'cron') commit({ mode, cron: '0 9 * * *', timezone })
    },
    [commit, schedule],
  )

  const setTimezone = useCallback(
    (timezone: string) => {
      commit(withTimezone(schedule, timezone))
    },
    [commit, schedule],
  )

  const toggleWeekday = useCallback(
    (weekday: number) => {
      if (schedule.mode !== 'weekly') return
      const next = schedule.weekdays.includes(weekday)
        ? schedule.weekdays.filter((item) => item !== weekday)
        : [...schedule.weekdays, weekday].sort((a, b) => a - b)
      commit({ ...schedule, weekdays: next.length > 0 ? next : [weekday] })
    },
    [commit, schedule],
  )

  const toggleMonthDay = useCallback(
    (day: number) => {
      if (schedule.mode !== 'monthly') return
      const next = schedule.days.includes(day)
        ? schedule.days.filter((item) => item !== day)
        : [...schedule.days, day].sort((a, b) => a - b)
      commit({ ...schedule, days: next.length > 0 ? next : [day] })
    },
    [commit, schedule],
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2">
        <span className="text-xs text-muted-foreground">频率</span>
        <Select
          value={schedule.mode}
          onValueChange={(value) => setMode(value as ScheduleConfig['mode'])}
        >
          <SelectTrigger size="xs" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="interval">每隔多久</SelectItem>
            <SelectItem value="daily">每天</SelectItem>
            <SelectItem value="weekly">每周</SelectItem>
            <SelectItem value="monthly">每月</SelectItem>
            <SelectItem value="cron">自定义 Cron</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {schedule.mode === 'interval' && (
        <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2">
          <span className="text-xs text-muted-foreground">间隔</span>
          <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2">
            <Input
              size="sm"
              type="text"
              inputMode="numeric"
              value={String(schedule.every)}
              onChange={(event) => {
                const next = Number(event.target.value)
                if (!Number.isInteger(next) || next < 1) return
                commit({ ...schedule, every: next })
              }}
            />
            <Select
              value={schedule.unit}
              onValueChange={(unit) =>
                commit({ ...schedule, unit: unit as 'minute' | 'hour' | 'day' })
              }
            >
              <SelectTrigger size="xs" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minute">分钟</SelectItem>
                <SelectItem value="hour">小时</SelectItem>
                <SelectItem value="day">天</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {schedule.mode === 'daily' && (
        <TimeRow value={schedule.time} onChange={(time) => commit({ ...schedule, time })} />
      )}

      {schedule.mode === 'weekly' && (
        <>
          <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2">
            <span className="text-xs text-muted-foreground">星期</span>
            <div className="flex flex-wrap gap-1">
              {WEEKDAYS.map((weekday) => (
                <TogglePill
                  key={weekday.value}
                  selected={schedule.weekdays.includes(weekday.value)}
                  onClick={() => toggleWeekday(weekday.value)}
                >
                  {weekday.label}
                </TogglePill>
              ))}
            </div>
          </div>
          <TimeRow value={schedule.time} onChange={(time) => commit({ ...schedule, time })} />
        </>
      )}

      {schedule.mode === 'monthly' && (
        <>
          <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
            <span className="pt-1 text-xs text-muted-foreground">日期</span>
            <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto rounded-md border border-border p-1">
              {MONTH_DAYS.map((day) => (
                <TogglePill
                  key={day}
                  selected={schedule.days.includes(day)}
                  onClick={() => toggleMonthDay(day)}
                >
                  {day}
                </TogglePill>
              ))}
            </div>
          </div>
          <TimeRow value={schedule.time} onChange={(time) => commit({ ...schedule, time })} />
        </>
      )}

      {schedule.mode === 'cron' && (
        <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2">
          <span className="text-xs text-muted-foreground">Cron</span>
          <Input
            size="sm"
            className="font-mono"
            value={schedule.cron}
            placeholder="0 9 * * *"
            onChange={(event) => commit({ ...schedule, cron: event.target.value })}
          />
        </div>
      )}

      <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2">
        <span className="text-xs text-muted-foreground">时区</span>
        <Select value={getTimezone(schedule)} onValueChange={setTimezone}>
          <SelectTrigger size="xs" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((timezone) => (
              <SelectItem key={timezone.value} value={timezone.value}>
                {timezone.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function TimeRow({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2">
      <span className="text-xs text-muted-foreground">时间</span>
      <Input
        size="sm"
        type="time"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function TogglePill({
  selected,
  children,
  onClick,
}: {
  selected: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      size="xs"
      variant={selected ? 'default' : 'outline'}
      className={cn('h-6 min-w-6 px-1.5 text-xs', selected && 'text-primary-foreground')}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

export { ScheduleField, normalizeSchedule }
