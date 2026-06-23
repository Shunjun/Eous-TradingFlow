import type { NodeComponentProps } from '../types'
import { NodeCard, emptyValue } from '../ui/node-card'
import { def } from './def'

function formatChangePercent(value: unknown): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function CanvasNode({ data }: NodeComponentProps) {
  const symbol = typeof data.symbol === 'string' ? data.symbol : '--'
  const price = typeof data.price === 'number' ? data.price.toFixed(2) : '--'
  const changePercent = formatChangePercent(data.changePercent)
  const label = typeof data.label === 'string' ? data.label : def.meta.label
  const color = typeof data.color === 'string' ? data.color : undefined

  return (
    <NodeCard
      icon={def.meta.icon}
      title={label}
      color={color}
      details={[
        { label: 'Symbol', value: emptyValue(symbol) },
        { label: 'Price', value: price },
        { label: 'Change', value: changePercent },
      ]}
    />
  )
}

export { CanvasNode }
