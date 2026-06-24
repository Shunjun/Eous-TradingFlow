import type { NodeDef } from '../../types'
export { getCanvasView } from './canvas'

export const def: NodeDef = {
  meta: {
    type: 'trigger.start',
    category: 'trigger',
    label: 'Start',
    icon: 'play',
    description: '手动启动工作流，并输出启动时传入的文本',
    color: '#22C55E',
  },
  connection: {
    source: true,
  },
  executeInput: {},
  executeOutput: {
    userInput: {
      name: 'userInput',
      type: 'string',
      source: { field: 'userInput' },
      description: '启动工作流时传入的文本',
    },
    triggeredAt: {
      name: 'triggeredAt',
      type: 'string',
      source: { field: 'triggeredAt' },
      description: '触发时间',
    },
  },
}
