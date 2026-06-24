import type { NodeCanvasViewInput } from '../../types'
import { def } from './def'

function getCanvasView({ data }: NodeCanvasViewInput) {
  const label = typeof data.label === 'string' ? data.label : def.meta.label
  const color = typeof data.color === 'string' ? data.color : undefined

  return {
    icon: def.meta.icon,
    title: label,
    color,
    rows: [{ label: 'Input', value: '启动参数' }],
  }
}

export { getCanvasView }
