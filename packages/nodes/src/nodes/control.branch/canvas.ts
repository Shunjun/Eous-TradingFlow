import type { NodeCanvasViewInput } from '../../types'
import type { BranchCondition } from '../../types'
import { def } from './def'

const DEFAULT_BRANCHES: BranchCondition[] = [
  { id: 'if', type: 'if', condition: '' },
  { id: 'else', type: 'else' },
]

function getBranches(value: unknown): BranchCondition[] {
  if (!Array.isArray(value)) return DEFAULT_BRANCHES
  const branches = value.filter((item): item is BranchCondition => {
    if (!item || typeof item !== 'object') return false
    const branch = item as Record<string, unknown>
    return (
      typeof branch.id === 'string' &&
      (branch.type === 'if' || branch.type === 'else-if' || branch.type === 'else')
    )
  })
  return branches.length > 0 ? branches : DEFAULT_BRANCHES
}

function emptyValue(value: string | number | undefined | null): string | number {
  if (value === undefined || value === null || value === '') return '--'
  return value
}

function getCanvasView({ data }: NodeCanvasViewInput) {
  const label = typeof data.label === 'string' ? data.label : def.meta.label
  const color = typeof data.color === 'string' ? data.color : undefined
  const branches = getBranches(data.branches)

  return {
    icon: def.meta.icon,
    title: label,
    color,
    rows: branches.map((branch) => ({
      field: branch.id,
      label: branch.type === 'else-if' ? 'else if' : branch.type,
      value: branch.type === 'else' ? '' : emptyValue(branch.condition),
      source: true,
    })),
  }
}

export { getCanvasView }
