import type { ScheduleConfig } from '../../types'

export interface ExecuteInput {
  schedule?: ScheduleConfig
}

export interface ExecuteOutput {
  triggeredAt: string
  scheduledAt: string
  scheduleMode: string
  timezone: string
}
