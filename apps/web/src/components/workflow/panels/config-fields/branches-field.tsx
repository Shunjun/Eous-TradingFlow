import { useCallback } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button, Input } from '@eous/ui'
import type { BranchCondition, ParamDef } from '@eous/nodes'

interface BranchesFieldProps {
  param: ParamDef
  value: unknown
  onChange: (value: unknown) => void
}

const DEFAULT_BRANCHES: BranchCondition[] = [
  { id: 'if', type: 'if', condition: '' },
  { id: 'else', type: 'else' },
]

function normalizeBranches(value: unknown): BranchCondition[] {
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

function createBranchId() {
  return `else-if-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function BranchesField({ value, onChange }: BranchesFieldProps) {
  const branches = normalizeBranches(value)

  const commit = useCallback(
    (nextBranches: BranchCondition[]) => {
      const hasElse = nextBranches.some((branch) => branch.type === 'else')
      onChange(hasElse ? nextBranches : [...nextBranches, { id: 'else', type: 'else' }])
    },
    [onChange],
  )

  const updateCondition = useCallback(
    (id: string, condition: string) => {
      commit(branches.map((branch) => (branch.id === id ? { ...branch, condition } : branch)))
    },
    [branches, commit],
  )

  const addElseIf = useCallback(() => {
    const elseIndex = branches.findIndex((branch) => branch.type === 'else')
    const nextBranch: BranchCondition = {
      id: createBranchId(),
      type: 'else-if',
      condition: '',
    }
    if (elseIndex === -1) {
      commit([...branches, nextBranch])
      return
    }
    commit([...branches.slice(0, elseIndex), nextBranch, ...branches.slice(elseIndex)])
  }, [branches, commit])

  const deleteBranch = useCallback(
    (id: string) => {
      const branch = branches.find((item) => item.id === id)
      if (!branch || branch.type === 'if' || branch.type === 'else') return
      commit(branches.filter((item) => item.id !== id))
    },
    [branches, commit],
  )

  return (
    <div className="flex flex-col gap-2">
      {branches.map((branch) => (
        <div key={branch.id} className="flex items-center gap-2">
          <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">
            {branch.type === 'else-if' ? 'else if' : branch.type}
          </span>
          {branch.type === 'else' ? (
            <span className="flex h-8 min-w-0 flex-1 items-center rounded-md border border-dashed border-border px-2 text-xs text-muted-foreground">
              默认分支
            </span>
          ) : (
            <Input
              size="sm"
              className="font-mono"
              placeholder="条件表达式"
              value={branch.condition ?? ''}
              onChange={(event) => updateCondition(branch.id, event.target.value)}
            />
          )}
          {branch.type === 'else-if' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => deleteBranch(branch.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="xs" className="w-fit" onClick={addElseIf}>
        <Plus className="h-3 w-3" />
        添加 else if
      </Button>
    </div>
  )
}

export { BranchesField, normalizeBranches }
