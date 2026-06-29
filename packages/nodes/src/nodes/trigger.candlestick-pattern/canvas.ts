import type { NodeCanvasViewInput } from '../../types'
import { def } from './def'

function emptyValue(value: string | number | undefined | null): string | number {
  if (value === undefined || value === null || value === '') return '--'
  return value
}

function getCanvasView({ data }: NodeCanvasViewInput) {
  const symbol = String(data.symbol ?? '')
  const interval = String(data.interval ?? '5m')
  const pattern = Array.isArray(data.patterns)
    ? data.patterns.join(', ')
    : String(data.patterns ?? 'HAMMER')
  const direction = String(data.direction ?? 'ANY')
  const label = typeof data.label === 'string' ? data.label : def.meta.label
  const color = typeof data.color === 'string' ? data.color : undefined

  return {
    icon: def.meta.icon,
    title: label,
    color,
    rows: [
      { label: 'Symbol', value: emptyValue(symbol) },
      { label: 'Interval', value: interval },
      { label: 'Pattern', value: pattern },
      { label: 'Direction', value: direction },
    ],
  }
}

export { getCanvasView }
