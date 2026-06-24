import type { ExecuteContext, ScheduleConfig } from '../../types'
import { defaultSchedule } from './def'
import type { ExecuteInput, ExecuteOutput } from './types'

function normalizeSchedule(value: unknown): ScheduleConfig {
  if (!value || typeof value !== 'object') return defaultSchedule
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
  return defaultSchedule
}

async function execute(input: ExecuteInput, _ctx: ExecuteContext): Promise<ExecuteOutput> {
  const schedule = normalizeSchedule(input.schedule)
  const now = new Date().toISOString()
  const scheduledAt =
    typeof _ctx.workflowInput?.scheduledAt === 'string' ? _ctx.workflowInput.scheduledAt : now

  return {
    triggeredAt: now,
    scheduledAt,
    scheduleMode: schedule.mode,
    timezone: schedule.timezone,
  }
}

export { execute }
