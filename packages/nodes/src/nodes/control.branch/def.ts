import type { NodeDef } from '../../types'
export { getCanvasView } from './canvas'

export const def: NodeDef = {
  meta: {
    type: 'control.branch',
    category: 'control',
    label: '条件分支',
    icon: 'git-branch',
    description: '根据条件选择执行路径',
    color: '#8B5CF6',
  },
  connection: {
    target: true,
  },
  executeInput: {
    branches: {
      type: 'array',
      from: 'panel',
      required: true,
      label: '条件分支',
      ui: 'branches',
      default: [
        { id: 'if', type: 'if', condition: '' },
        { id: 'else', type: 'else' },
      ],
    },
  },
  executeOutput: {
    selectedBranch: {
      name: 'selectedBranch',
      type: 'string',
      source: { field: 'selectedBranch' },
      description: '命中的分支 ID',
    },
    matched: {
      name: 'matched',
      type: 'boolean',
      source: { field: 'matched' },
      description: '是否命中条件分支',
    },
  },
}
