import { useMemo, useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Badge, ScrollArea, toast } from '@eous/ui'
import { getNodeDef, allNodeMetas } from '@eous/nodes'
import { api } from '../../../lib/api'
import { useWorkflowStore } from '../store/workflow-store'
import { getEffectiveOutputs } from '../panels/settings-panel-outputs'

interface VariableInspectorProps {
  workflowId: string
}

const NODE_LABELS: Record<string, string> = Object.fromEntries(
  allNodeMetas.map((m) => [m.type, m.label]),
)

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

function VariableInspector({ workflowId }: VariableInspectorProps) {
  const [variables, setVariables] = useState<Record<string, Record<string, unknown>>>({})
  const [loading, setLoading] = useState(true)
  const storeNodes = useWorkflowStore((s) => s.nodes)
  const executionRefreshToken = useWorkflowStore((s) => s.executionRefreshToken)

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
  }, [workflowId, executionRefreshToken])

  const entries = useMemo(
    () =>
      storeNodes
        .map((node) => ({
          node,
          outputs: getEffectiveOutputs(node.data ?? {}, getNodeDef(node.type ?? '')),
          rawOutputs: variables[node.id],
        }))
        .filter((entry) => entry.outputs.length > 0),
    [storeNodes, variables],
  )

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-muted-foreground">当前工作流暂无可用变量</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full w-full overflow-hidden">
      <div className="box-border flex w-full min-w-0 max-w-full flex-col gap-4 overflow-hidden px-4 py-4">
        {entries.map(({ node, outputs, rawOutputs }) => {
          const nodeLabel =
            typeof node.data.label === 'string'
              ? node.data.label
              : getNodeTypeLabel(node.type ?? node.id)
          const hasCachedOutputs = Boolean(rawOutputs)

          return (
            <div key={node.id} className="flex min-w-0 flex-col gap-1.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <p className="min-w-0 truncate text-[11px] font-medium text-foreground">
                  {nodeLabel}
                </p>
                <Badge
                  variant={hasCachedOutputs ? 'secondary' : 'outline'}
                  className="shrink-0 text-[10px]"
                >
                  {hasCachedOutputs ? '有运行值' : '未运行'}
                </Badge>
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                {outputs.map((output) => {
                  const raw = rawOutputs?.[output.source.field]
                  const ok = output.source.path ? resolvePath(raw, output.source.path).ok : true
                  const variableDisplay = `${nodeLabel}.${output.name}`
                  const variableRef = `{{node:${node.id}:${output.name}}}`
                  const detailText = output.description ?? '无说明'

                  return (
                    <button
                      key={output.name}
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(variableRef)
                        toast.success('已复制变量引用')
                      }}
                      className="box-border flex w-full min-w-0 max-w-full flex-col gap-0.5 overflow-hidden rounded-md bg-muted/25 px-2 py-1.5 text-left transition-colors hover:bg-muted/45"
                      title={`复制 ${variableRef}`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="block min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                          {variableDisplay}
                        </span>
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          {output.type}
                        </Badge>
                      </div>
                      <span
                        className={
                          ok || !hasCachedOutputs
                            ? 'block min-w-0 max-w-full truncate text-[10px] text-muted-foreground'
                            : 'block min-w-0 max-w-full truncate text-[10px] text-destructive'
                        }
                      >
                        {detailText}
                      </span>
                    </button>
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
