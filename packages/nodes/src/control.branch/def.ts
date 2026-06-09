import type { NodeDef } from '../types'
export { CanvasNode } from './canvas'

export const def: NodeDef = {
  meta: {
    type: 'control.branch',
    category: 'control',
    label: '条件分支',
    icon: 'git-branch',
    description: '根据条件选择执行路径',
    color: '#8B5CF6',
  },
  executeInput: {
    condition: {
      type: 'string',
      from: 'panel',
      required: true,
      label: '条件表达式',
      placeholder: '如 {{signal.signal}} === "long"',
      ui: 'code',
    },
    trueValue: {
      type: 'string',
      from: 'panel',
      label: 'True 值',
      placeholder: '条件为 true 时传递的值',
    },
    falseValue: {
      type: 'string',
      from: 'panel',
      label: 'False 值',
      placeholder: '条件为 false 时传递的值',
    },
  },
  executeOutput: {
    result: {
      name: 'result',
      type: 'boolean',
      source: { field: 'result' },
      description: '条件判断结果',
    },
    value: {
      name: 'value',
      type: 'string',
      source: { field: 'value' },
      description: '根据条件选择的值',
    },
  },
}
