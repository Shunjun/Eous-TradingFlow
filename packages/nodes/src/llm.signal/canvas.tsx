import type { NodeComponentProps } from '../types'
import { NodeCard, emptyValue } from '../ui/node-card'
import { def } from './def'

function CanvasNode({ data }: NodeComponentProps) {
  const label = typeof data.label === 'string' ? data.label : def.meta.label
  const color = typeof data.color === 'string' ? data.color : undefined
  const modelId = typeof data.modelId === 'string' ? data.modelId : ''
  const temperature = typeof data.temperature === 'number' ? data.temperature : undefined

  return (
    <NodeCard
      icon={def.meta.icon}
      title={label}
      color={color}
      details={[
        { label: 'Model', value: emptyValue(modelId) },
        { label: 'Output', value: 'JSON signal' },
        { label: 'Temp', value: emptyValue(temperature) },
      ]}
    />
  )
}

export { CanvasNode }
