import type { NodeCanvasViewInput } from '../../types'
import { def } from './def'

function emptyValue(value: string | number | undefined | null): string | number {
  if (value === undefined || value === null || value === '') return '--'
  return value
}

function formatChangePercent(value: unknown): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function getCanvasView({ data }: NodeCanvasViewInput) {
  const symbol = typeof data.symbol === 'string' ? data.symbol : '--'
  const price = typeof data.price === 'number' ? data.price.toFixed(2) : '--'
  const changePercent = formatChangePercent(data.changePercent)
  const label = typeof data.label === 'string' ? data.label : def.meta.label
  const color = typeof data.color === 'string' ? data.color : undefined

  return {
    icon: def.meta.icon,
    title: label,
    color,
    rows: [
      { label: 'Symbol', value: emptyValue(symbol) },
      { label: 'Price', value: price },
      { label: 'Change', value: changePercent },
    ],
  }
}

export { getCanvasView }
