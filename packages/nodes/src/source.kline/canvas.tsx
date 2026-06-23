import type { NodeComponentProps } from '../types'
import { NodeCard, emptyValue } from '../ui/node-card'
import { def } from './def'

function CanvasNode({ data }: NodeComponentProps) {
  const symbol = String(data.symbol ?? '')
  const interval = String(data.interval ?? '1d')
  const limit = Number(data.limit ?? 90)
  const label = typeof data.label === 'string' ? data.label : def.meta.label
  const color = typeof data.color === 'string' ? data.color : undefined

  return (
    <NodeCard
      icon={def.meta.icon}
      title={label}
      color={color}
      details={[
        { label: 'Symbol', value: emptyValue(symbol) },
        { label: 'Interval', value: interval },
        { label: 'Limit', value: `${limit} bars` },
      ]}
    />
  )
}

export { CanvasNode }
