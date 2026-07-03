import type { NodeCanvasViewInput } from '../../types'
import { def } from './def'

function emptyValue(value: string | number | undefined | null): string | number {
  if (value === undefined || value === null || value === '') return '--'
  return value
}

function getCanvasView({ data }: NodeCanvasViewInput) {
  const label = typeof data.label === 'string' ? data.label : def.meta.label
  const color = typeof data.color === 'string' ? data.color : undefined
  const topK = Number(data.topK ?? 5)
  const mode = typeof data.retrievalMode === 'string' ? data.retrievalMode : 'vector'

  return {
    icon: def.meta.icon,
    title: label,
    color,
    rows: [
      { label: 'KB', value: emptyValue(data.knowledgeBaseId as string | undefined) },
      { label: 'Mode', value: mode },
      { label: 'Top K', value: topK },
    ],
  }
}

export { getCanvasView }
