import type { NodeCanvasViewInput } from '../../types'
import { def } from './def'

function emptyValue(value: string | number | undefined | null): string | number {
  if (value === undefined || value === null || value === '') return '--'
  return value
}

function getCanvasView({ data }: NodeCanvasViewInput) {
  const label = typeof data.label === 'string' ? data.label : def.meta.label
  const color = typeof data.color === 'string' ? data.color : undefined
  const modelId = typeof data.modelId === 'string' ? data.modelId : ''
  const maxTokens = typeof data.maxTokens === 'number' ? data.maxTokens : undefined

  return {
    icon: def.meta.icon,
    title: label,
    color,
    rows: [
      { label: 'Model', value: emptyValue(modelId) },
      { label: 'Output', value: 'Free text' },
      { label: 'Tokens', value: emptyValue(maxTokens) },
    ],
  }
}

export { getCanvasView }
