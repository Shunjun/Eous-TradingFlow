import type { NodeComponentProps } from '../types'
import { NodeCard, emptyValue } from '../ui/node-card'
import { def } from './def'

function CanvasNode({ data }: NodeComponentProps) {
  const condition = typeof data.condition === 'string' ? data.condition : ''
  const label = typeof data.label === 'string' ? data.label : def.meta.label
  const color = typeof data.color === 'string' ? data.color : undefined
  const trueValue = typeof data.trueValue === 'string' ? data.trueValue : ''
  const falseValue = typeof data.falseValue === 'string' ? data.falseValue : ''

  return (
    <NodeCard
      icon={def.meta.icon}
      title={label}
      color={color}
      details={[
        { label: 'If', value: emptyValue(condition) },
        { label: 'True', value: emptyValue(trueValue) },
        { label: 'False', value: emptyValue(falseValue) },
      ]}
    />
  )
}

export { CanvasNode }
