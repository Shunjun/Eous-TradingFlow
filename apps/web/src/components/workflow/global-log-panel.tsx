import { useState, useEffect, useCallback, useRef } from 'react'
import { X, RefreshCw, ChevronDown, ChevronRight, Loader2, GripHorizontal } from 'lucide-react'
import { Badge, Button, ScrollArea, cn } from '@eous/ui'
import { api } from '../../lib/api'
import { useWorkflowStore } from '../../stores/workflow'

interface ExecutionLog {
  ts: string
  level: string
  message: string
}

interface ExecutionEntry {
  id: string
  nodeId: string
  nodeType: string
  status: string
  inputs: Record<string, unknown> | null
  outputs: Record<string, unknown> | null
  logs: ExecutionLog[]
  durationMs: number | null
  error: string | null
  startedAt: string
  finishedAt: string | null
}

interface GlobalLogPanelProps {
  workflowId: string
  open: boolean
  onClose: () => void
  onHeightChange?: (height: number) => void
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('zh-CN', { hour12: false })
  } catch {
    return iso
  }
}

function formatDuration(ms: number | null): string {
  if (ms == null) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const LOG_HEADER_H = 40
const LOG_MIN_H = 100
const LOG_DEFAULT_H = 320

function GlobalLogPanel({ workflowId, open, onClose, onHeightChange }: GlobalLogPanelProps) {
  const [executions, setExecutions] = useState<ExecutionEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const storeNodes = useWorkflowStore((s) => s.nodes)
  const [height, setHeight] = useState(LOG_DEFAULT_H)
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)

  // Report height to parent
  useEffect(() => {
    onHeightChange?.(height)
  }, [height, onHeightChange])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      dragRef.current = { startY: e.clientY, startH: height }
    },
    [height],
  )

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return
    const delta = dragRef.current.startY - e.clientY
    const next = Math.max(LOG_MIN_H, dragRef.current.startH + delta)
    setHeight(next)
  }, [])

  const handlePointerUp = useCallback(() => {
    dragRef.current = null
  }, [])

  const fetchExecutions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getWorkflowExecutions(workflowId, 50)
      setExecutions(res.executions)
    } catch {
      setExecutions([])
    } finally {
      setLoading(false)
    }
  }, [workflowId])

  useEffect(() => {
    if (open) fetchExecutions()
  }, [open, fetchExecutions])

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const getNodeLabel = (entry: ExecutionEntry) => {
    const node = storeNodes.find((n) => n.id === entry.nodeId)
    if (node && typeof node.data.label === 'string') return node.data.label
    const labels: Record<string, string> = {
      'source.kline': 'K线数据',
      'source.price': '实时报价',
      'control.branch': '条件分支',
    }
    return labels[entry.nodeType] ?? entry.nodeType
  }

  return (
    <div
      className={cn(
        'pointer-events-auto absolute bottom-0 left-0 right-0 z-30 overflow-hidden border-t border-border bg-card/95 shadow-lg backdrop-blur',
        'transition-[transform] duration-300 ease-out',
        open ? 'translate-y-0' : 'translate-y-[calc(100%-40px)]',
      )}
      style={{ height: open ? height : LOG_HEADER_H }}
    >
      {/* Drag handle — at top edge */}
      {open && (
        <div
          className="flex h-1.5 cursor-row-resize items-center justify-center hover:bg-accent"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <GripHorizontal className="h-3 w-8 text-muted-foreground/50" />
        </div>
      )}

      {/* Header bar — always visible */}
      <div className="flex h-10 items-center justify-between border-b border-border px-4">
        <span className="text-sm font-medium text-foreground">运行日志</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={fetchExecutions}
            disabled={loading}
          >
            <RefreshCw className={cn('mr-1 h-3 w-3', loading && 'animate-spin')} />
            刷新
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {open && (
        <ScrollArea className="h-[calc(100%-46px)]">
          {loading && executions.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : executions.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-xs text-muted-foreground">暂无运行记录</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1 p-3">
              {executions.map((entry) => {
                const isExpanded = expandedIds.has(entry.id)
                const nodeLabel = getNodeLabel(entry)

                return (
                  <div key={entry.id} className="rounded-md border border-border/50 bg-muted/30">
                    {/* Summary row */}
                    <button
                      type="button"
                      onClick={() => toggleExpand(entry.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-accent/50"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(entry.startedAt)}
                      </span>
                      <Badge
                        variant={entry.status === 'succeeded' ? 'default' : 'destructive'}
                        className="h-4 px-1 text-[9px]"
                      >
                        {entry.status === 'succeeded' ? '✓' : '✗'}
                      </Badge>
                      <span className="flex-1 truncate text-xs font-medium text-foreground">
                        {nodeLabel}
                      </span>
                      <span className="text-[10px] text-muted-foreground">({entry.nodeType})</span>
                      {entry.durationMs != null && (
                        <span className="text-[10px] text-muted-foreground">
                          {formatDuration(entry.durationMs)}
                        </span>
                      )}
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="border-t border-border/50 px-3 py-2">
                        {/* Logs */}
                        {entry.logs.length > 0 && (
                          <div className="mb-2 flex flex-col gap-0.5">
                            {entry.logs.map((log, i) => (
                              <div key={i} className="flex items-start gap-1.5 text-[10px]">
                                <Badge
                                  variant={
                                    log.level === 'error'
                                      ? 'destructive'
                                      : log.level === 'warn'
                                        ? 'outline'
                                        : 'secondary'
                                  }
                                  className="shrink-0 text-[9px]"
                                >
                                  {log.level}
                                </Badge>
                                <span className="text-foreground">{log.message}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {entry.error && (
                          <p className="mb-2 text-[10px] text-destructive">{entry.error}</p>
                        )}

                        {/* Inputs */}
                        {entry.inputs && (
                          <div className="mb-1 flex flex-col gap-0.5">
                            <p className="text-[10px] font-medium text-muted-foreground">输入</p>
                            <pre className="overflow-x-auto rounded bg-muted/50 p-1.5 text-[10px] text-foreground">
                              {JSON.stringify(entry.inputs, null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Outputs */}
                        {entry.outputs && (
                          <div className="flex flex-col gap-0.5">
                            <p className="text-[10px] font-medium text-muted-foreground">输出</p>
                            <pre className="overflow-x-auto rounded bg-muted/50 p-1.5 text-[10px] text-foreground">
                              {JSON.stringify(entry.outputs, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      )}
    </div>
  )
}

GlobalLogPanel.displayName = 'GlobalLogPanel'

export { GlobalLogPanel }
