import { Braces } from 'lucide-react'
import type { Node } from '@xyflow/react'
import { cn } from '@eous/ui'
import { useWorkflowStore } from '../store/workflow-store'
import { parseVariableRef } from './variable-ref'
import type { VariableRef } from './variable-picker'

interface VariableTagProps {
  value?: string
  refValue?: VariableRef | null
  className?: string
  size?: 'xs' | 'sm'
}

function getVariableLabel(ref: VariableRef | null, nodes: Node[]) {
  if (!ref) return ''
  const node = ref.nodeId ? nodes.find((item) => item.id === ref.nodeId) : null
  const nodeLabel = node && typeof node.data.label === 'string' ? node.data.label : ref.nodeLabel
  return `${nodeLabel}.${ref.fieldName}`
}

function VariableTag({ value, refValue, className, size = 'sm' }: VariableTagProps) {
  const nodes = useWorkflowStore((state) => state.nodes)
  const parsed = refValue ?? (value ? parseVariableRef(value) : null)
  if (!parsed) return null
  const node = parsed.nodeId ? nodes.find((item) => item.id === parsed.nodeId) : null
  const nodeLabel = node && typeof node.data.label === 'string' ? node.data.label : parsed.nodeLabel

  return (
    <span
      className={cn(
        'inline-flex min-w-0 max-w-full items-center gap-1 rounded-md border border-border bg-muted/60 font-mono text-foreground',
        size === 'xs' ? 'h-4 px-1 text-[9px]' : 'h-5 px-1.5 text-[10px]',
        className,
      )}
      title={getVariableLabel(parsed, nodes)}
    >
      <Braces
        className={cn('shrink-0 text-muted-foreground', size === 'xs' ? 'h-2.5 w-2.5' : 'h-3 w-3')}
      />
      <span className="flex min-w-0 items-center truncate leading-none">
        <span className="text-muted-foreground">{nodeLabel}</span>
        <span className="text-muted-foreground">.</span>
        <span className="text-amber-600">{parsed.fieldName}</span>
      </span>
    </span>
  )
}

export { VariableTag, getVariableLabel }
export type { VariableTagProps }
