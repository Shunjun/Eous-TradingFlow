import type { NodeDef } from '../../types'
export { getCanvasView } from './canvas'

export const defaultSchedule = {
  mode: 'daily',
  time: '09:00',
  timezone: 'Asia/Shanghai',
} as const

export const def: NodeDef = {
  meta: {
    type: 'trigger.schedule',
    category: 'trigger',
    label: '定时触发',
    icon: 'calendar-clock',
    description: '按设定的时间规则自动触发工作流',
    color: '#F97316',
  },
  connection: {
    source: true,
  },
  executeInput: {
    schedule: {
      type: 'object',
      from: 'panel',
      required: true,
      label: '触发规则',
      ui: 'schedule',
      default: defaultSchedule,
    },
  },
  executeOutput: {
    triggeredAt: {
      name: 'triggeredAt',
      type: 'string',
      source: { field: 'triggeredAt' },
      description: '实际触发时间',
    },
    scheduledAt: {
      name: 'scheduledAt',
      type: 'string',
      source: { field: 'scheduledAt' },
      description: '计划触发时间',
    },
    scheduleMode: {
      name: 'scheduleMode',
      type: 'string',
      source: { field: 'scheduleMode' },
      description: '触发规则类型',
    },
    timezone: {
      name: 'timezone',
      type: 'string',
      source: { field: 'timezone' },
      description: '触发时区',
    },
  },
}
