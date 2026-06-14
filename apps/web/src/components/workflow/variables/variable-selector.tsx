import { useMemo, useCallback } from 'react'
import { Link } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent, Badge, ScrollArea, cn } from '@eous/ui'
import { getNodeOutputs, type OutputField } from '@eous/nodes'
import { useWorkflowStore } from '../../../stores/workflow'
import type { Edge } from '@xyflow/react'

interface VariableRef {
  nodeId: string
  nodeLabel: string
  fieldName: string
  fieldType: string
}

function getUpstreamNodes(nodeId: string, edges: Edge[]) {
  const store = useWorkflowStore.getState()
  const upstreamIds = new Set<string>()
  for (const edge of edges) {
    if (edge.target === nodeId) {
      upstreamIds.add(edge.source)
    }
  }
  return store.nodes.filter((n) => upstreamIds.has(n.id))
}

interface VariableOption {
  nodeId: string
  nodeLabel: string
  field: OutputField
}

interface VariableSelectorProps {
  nodeId: string
  currentValue?: VariableRef
  onSelect: (ref: VariableRef) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

function VariableSelector({
  nodeId,
  currentValue,
  onSelect,
  open,
  onOpenChange,
}: VariableSelectorProps) {
  const edges = useWorkflowStore((s) => s.edges)

  const variables = useMemo(() => {
    const upstreamNodes = getUpstreamNodes(nodeId, edges)
    const groups: { nodeLabel: string; options: VariableOption[] }[] = []

    for (const node of upstreamNodes) {
      if (!node.type) continue
      const outputs = getNodeOutputs(node.type)
      if (!outputs) continue

      const label = typeof node.data.label === 'string' ? node.data.label : node.type
      const options: VariableOption[] = Object.values(outputs).map((field) => ({
        nodeId: node.id,
        nodeLabel: label,
        field,
      }))

      if (options.length > 0) {
        groups.push({ nodeLabel: label, options })
      }
    }

    return groups
  }, [nodeId, edges])

  const handleSelect = useCallback(
    (option: VariableOption) => {
      onSelect({
        nodeId: option.nodeId,
        nodeLabel: option.nodeLabel,
        fieldName: option.field.name,
        fieldType: option.field.type,
      })
      onOpenChange(false)
    },
    [onSelect, onOpenChange],
  )

  if (variables.length === 0) {
    return null
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-6 items-center gap-1 rounded-md border border-border px-1.5 text-[10px] transition-colors hover:bg-accent',
            currentValue ? 'border-primary/30 bg-primary/5 text-primary' : 'text-muted-foreground',
          )}
        >
          <Link className="h-3 w-3" />
          {currentValue ? `${currentValue.nodeLabel} > ${currentValue.fieldName}` : '选上游变量'}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-64 p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="px-3 pt-3 pb-1">
          <p className="text-xs font-medium text-foreground">选择上游变量</p>
        </div>
        <ScrollArea className="max-h-60">
          <div className="px-1 pb-2">
            {variables.map((group) => (
              <div key={group.nodeLabel} className="mb-2">
                <p className="mb-1 px-2 text-[10px] font-medium text-muted-foreground">
                  {group.nodeLabel}
                </p>
                {group.options.map((option) => (
                  <button
                    key={`${option.nodeId}-${option.field.name}`}
                    type="button"
                    onClick={() => handleSelect(option)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
                  >
                    <span className="text-xs text-foreground">{option.field.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {option.field.type}
                    </Badge>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

VariableSelector.displayName = 'VariableSelector'

export { VariableSelector }
export type { VariableSelectorProps, VariableRef }
