import { useMemo, useCallback } from 'react'
import { Link } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent, Badge, ScrollArea, cn } from '@eous/ui'
import type { AcceptableType } from '@eous/nodes'
import { getNodeDef } from '@eous/nodes'
import { useWorkflowStore } from '../store/workflow-store'
import { getEffectiveOutputs } from '../panels/settings-panel-outputs'

interface VariableRef {
  nodeId: string
  nodeLabel: string
  fieldName: string
  fieldType: string
}

interface VariablePickerProps {
  nodeId: string
  acceptTypes?: AcceptableType[]
  upstreamOutputs: Record<string, Record<string, unknown>>
  onSelect: (ref: VariableRef) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  children?: React.ReactNode
  triggerClassName?: string
  currentValue?: VariableRef
}

// Map type names to AcceptableType for filtering
function typeToAcceptable(serverType: string): AcceptableType {
  const t = serverType.toLowerCase()
  if (t === 'number') return 'number'
  if (t === 'boolean') return 'boolean'
  if (t.includes('bar') || t.includes('array') || t.endsWith('[]')) return 'array'
  if (t === 'json' || t === 'object') return 'object'
  return 'string'
}

function typeMatchesAcceptable(serverType: string, acceptTypes?: AcceptableType[]): boolean {
  if (!acceptTypes || acceptTypes.length === 0) return true
  return acceptTypes.includes(typeToAcceptable(serverType))
}

function VariablePicker({
  nodeId,
  acceptTypes,
  upstreamOutputs,
  onSelect,
  open,
  onOpenChange,
  children,
  triggerClassName,
  currentValue,
}: VariablePickerProps) {
  const edges = useWorkflowStore((s) => s.edges)
  const storeNodes = useWorkflowStore((s) => s.nodes)

  const groups = useMemo(() => {
    const upstreamIds = new Set<string>()
    for (const edge of edges) {
      if (edge.target === nodeId) {
        upstreamIds.add(edge.source)
      }
    }

    const result: {
      nodeLabel: string
      nodeId: string
      fields: { name: string; type: string }[]
    }[] = []

    for (const id of upstreamIds) {
      // Skip nodes without cached outputs
      if (!upstreamOutputs[id]) continue

      const node = storeNodes.find((n) => n.id === id)
      const nodeLabel = node
        ? typeof node.data.label === 'string'
          ? node.data.label
          : (node.type ?? id)
        : id
      const nodeType = node?.type ?? ''

      const outputs = getEffectiveOutputs(node?.data ?? {}, getNodeDef(nodeType))

      const fields = outputs
        .filter((f) => typeMatchesAcceptable(f.type, acceptTypes))
        .map((f) => ({ name: f.name, type: f.type }))

      if (fields.length > 0) {
        result.push({ nodeLabel, nodeId: id, fields })
      }
    }

    return result
  }, [nodeId, edges, upstreamOutputs, acceptTypes, storeNodes])

  const handleSelect = useCallback(
    (nid: string, label: string, fieldName: string, fieldType: string) => {
      onSelect({ nodeId: nid, nodeLabel: label, fieldName, fieldType })
      onOpenChange(false)
    },
    [onSelect, onOpenChange],
  )

  if (groups.length === 0 && !children) return null

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {children ?? (
          <button
            type="button"
            className={cn(
              'inline-flex h-6 items-center gap-1 rounded-md border border-border px-1.5 text-[10px] transition-colors hover:bg-accent',
              currentValue
                ? 'border-primary/30 bg-primary/5 text-primary'
                : 'text-muted-foreground',
              triggerClassName,
            )}
          >
            <Link className="h-3 w-3" />
            {currentValue ? `${currentValue.nodeLabel} > ${currentValue.fieldName}` : '+var'}
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-64 p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="px-3 pt-3 pb-1">
          <p className="text-xs font-medium text-foreground">选择上游变量</p>
          {acceptTypes && acceptTypes.length > 0 && (
            <p className="text-[10px] text-muted-foreground">可用类型: {acceptTypes.join(', ')}</p>
          )}
        </div>
        <ScrollArea className="max-h-60">
          <div className="px-1 pb-2">
            {groups.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">无可用变量</p>
            ) : (
              groups.map((group) => (
                <div key={group.nodeId} className="mb-2">
                  <p className="mb-1 px-2 text-[10px] font-medium text-muted-foreground">
                    {group.nodeLabel}
                  </p>
                  {group.fields.map((field) => (
                    <button
                      key={`${group.nodeId}-${field.name}`}
                      type="button"
                      onClick={() =>
                        handleSelect(group.nodeId, group.nodeLabel, field.name, field.type)
                      }
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
                    >
                      <span className="text-xs text-foreground">{field.name}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {field.type}
                      </Badge>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

VariablePicker.displayName = 'VariablePicker'

export { VariablePicker }
export type { VariableRef, VariablePickerProps }
