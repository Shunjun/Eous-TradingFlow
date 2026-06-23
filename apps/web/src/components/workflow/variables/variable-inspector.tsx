import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Badge, ScrollArea } from '@eous/ui'
import { getNodeDef, allNodeMetas, type OutputDef, type NodeDef } from '@eous/nodes'
import { api } from '../../../lib/api'
import { useWorkflowStore } from '../store/workflow-store'

interface VariableInspectorProps {
  workflowId: string
}

const NODE_LABELS: Record<string, string> = Object.fromEntries(
  allNodeMetas.map((m) => [m.type, m.label]),
)

function getEffectiveOutputs(data: Record<string, unknown>, def: NodeDef | undefined): OutputDef[] {
  if (Array.isArray(data.outputs)) return data.outputs as OutputDef[]
  if (!def) return []
  return Object.values(def.executeOutput).map((f) => ({
    name: f.name,
    type: f.type as OutputDef['type'],
    source: f.source,
  }))
}

function getNodeTypeLabel(type: string): string {
  return NODE_LABELS[type] ?? type
}

/** Resolve a nested value by path like "[0].close" or ".close" */
function resolvePath(obj: unknown, path: string): { value: unknown; ok: boolean } {
  if (!path) return { value: obj, ok: true }
  try {
    const segments = path.replace(/^\./, '').split('.')
    let current: unknown = obj
    for (const seg of segments) {
      if (current == null || typeof current !== 'object') return { value: undefined, ok: false }
      const bracketMatch = seg.match(/^\[(\d+)\]$/)
      if (bracketMatch) {
        current = (current as Record<string, unknown>)[Number(bracketMatch[1])]
      } else {
        current = (current as Record<string, unknown>)[seg]
      }
    }
    return { value: current, ok: true }
  } catch {
    return { value: undefined, ok: false }
  }
}

function inferTypeDisplay(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
      const keys = Object.keys(value[0])
      if (keys.includes('open') && keys.includes('close')) return 'OHLCVBar[]'
    }
    return `array(${value.length})`
  }
  if (typeof value === 'object') return 'object'
  return typeof value
}

function VariableInspector({ workflowId }: VariableInspectorProps) {
  const [variables, setVariables] = useState<Record<string, Record<string, unknown>>>({})
  const [loading, setLoading] = useState(true)
  const storeNodes = useWorkflowStore((s) => s.nodes)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await api.getWorkflowVariables(workflowId)
        if (!cancelled) setVariables(res.variables)
      } catch {
        if (!cancelled) setVariables({})
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [workflowId])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const entries = Object.entries(variables)
  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-muted-foreground">暂无变量缓存</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-4">
        {entries.map(([nodeId, rawOutputs]) => {
          const node = storeNodes.find((n) => n.id === nodeId)
          const nodeLabel = node
            ? typeof node.data.label === 'string'
              ? node.data.label
              : getNodeTypeLabel(node.type ?? nodeId)
            : getNodeTypeLabel(nodeId)
          const nodeType = node?.type ?? ''
          const nodeDef = getNodeDef(nodeType)
          const effectiveOutputs = getEffectiveOutputs(node?.data ?? {}, nodeDef)

          return (
            <div key={nodeId} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium text-foreground">{nodeLabel}</p>
                <span className="text-[10px] text-muted-foreground">({nodeId})</span>
              </div>
              <div className="flex flex-col gap-1 pl-2">
                {effectiveOutputs.map((output) => {
                  const raw = rawOutputs[output.source.field]
                  const { value, ok } = output.source.path
                    ? resolvePath(raw, output.source.path)
                    : { value: raw, ok: true }

                  return (
                    <div key={output.name} className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-foreground">{output.name}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {output.type}
                      </Badge>
                      {!ok ? (
                        <span className="text-[10px] text-destructive">路径无效</span>
                      ) : typeof value !== 'object' && value !== undefined && value !== null ? (
                        <span className="truncate text-[10px] text-muted-foreground">
                          {String(value).slice(0, 50)}
                        </span>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}

VariableInspector.displayName = 'VariableInspector'

export { VariableInspector }
