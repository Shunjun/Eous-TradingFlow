import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ChevronsDown, ChevronsUp, Loader2 } from 'lucide-react'
import { Badge, Button, ScrollArea, cn } from '@eous/ui'
import { api } from '../../../lib/api'
import { useWorkflowStore } from '../store/workflow-store'

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

function GlobalLogPanel({ workflowId }: GlobalLogPanelProps) {
  const [executions, setExecutions] = useState<ExecutionEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null)
  const storeNodes = useWorkflowStore((s) => s.nodes)
  const open = useWorkflowStore((s) => s.logOpen)
  const executionRefreshToken = useWorkflowStore((s) => s.executionRefreshToken)
  const toggleLogOpen = useWorkflowStore((s) => s.toggleLogOpen)

  const fetchExecutions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getWorkflowExecutions(workflowId, 50)
      setExecutions(res.executions)
      setSelectedExecutionId((current) => {
        if (current && res.executions.some((execution) => execution.id === current)) return current
        return res.executions[0]?.id ?? null
      })
    } catch {
      setExecutions([])
    } finally {
      setLoading(false)
    }
  }, [workflowId])

  useEffect(() => {
    if (open) fetchExecutions()
  }, [open, fetchExecutions, executionRefreshToken])

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

  const selectedExecution =
    executions.find((execution) => execution.id === selectedExecutionId) ?? executions[0] ?? null

  return (
    <div
      className={cn(
        'pointer-events-auto h-full overflow-hidden border-t border-border bg-card/95 shadow-lg backdrop-blur flex flex-col',
      )}
    >
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
            onClick={toggleLogOpen}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {open ? <ChevronsDown className="h-4 w-4" /> : <ChevronsUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Content */}
      {open && (
        <div className="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)]">
          <div className="min-h-0 border-r border-border">
            <ScrollArea className="h-full">
              {loading && executions.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : executions.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-xs text-muted-foreground">暂无运行记录</p>
                </div>
              ) : (
                <div className="flex flex-col p-2">
                  {executions.map((entry) => {
                    const nodeLabel = getNodeLabel(entry)
                    const selected = selectedExecution?.id === entry.id

                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setSelectedExecutionId(entry.id)}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-2 py-2 text-left transition-colors',
                          selected
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-accent/50 hover:text-accent-foreground',
                        )}
                      >
                        <span className="w-14 shrink-0 text-[10px] text-muted-foreground">
                          {formatTime(entry.startedAt)}
                        </span>
                        <Badge
                          variant={entry.status === 'succeeded' ? 'default' : 'destructive'}
                          className="h-4 shrink-0 px-1 text-[9px]"
                        >
                          {entry.status === 'succeeded' ? '✓' : '✗'}
                        </Badge>
                        <span className="min-w-0 flex-1 truncate text-xs font-medium">
                          {nodeLabel}
                        </span>
                        {entry.durationMs != null && (
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {formatDuration(entry.durationMs)}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          <ScrollArea className="min-h-0">
            {selectedExecution ? (
              <div className="flex flex-col gap-3 p-3">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={selectedExecution.status === 'succeeded' ? 'default' : 'destructive'}
                    className="h-5 px-1.5 text-[10px]"
                  >
                    {selectedExecution.status}
                  </Badge>
                  <span className="truncate text-sm font-medium">
                    {getNodeLabel(selectedExecution)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {selectedExecution.nodeType}
                  </span>
                  {selectedExecution.durationMs != null && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatDuration(selectedExecution.durationMs)}
                    </span>
                  )}
                </div>

                {selectedExecution.logs.length > 0 && (
                  <section className="flex flex-col gap-1">
                    <p className="text-[10px] font-medium text-muted-foreground">日志</p>
                    <div className="flex flex-col gap-1 rounded-md bg-muted/40 p-2">
                      {selectedExecution.logs.map((log, i) => (
                        <div key={i} className="flex items-start gap-2 text-[11px]">
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
                          <span className="text-muted-foreground">{formatTime(log.ts)}</span>
                          <span className="text-foreground">{log.message}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {selectedExecution.error && (
                  <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                    {selectedExecution.error}
                  </p>
                )}

                {selectedExecution.inputs && (
                  <section className="flex flex-col gap-1">
                    <p className="text-[10px] font-medium text-muted-foreground">输入</p>
                    <pre className="overflow-x-auto rounded-md bg-muted/50 p-2 text-[10px] text-foreground">
                      {JSON.stringify(selectedExecution.inputs, null, 2)}
                    </pre>
                  </section>
                )}

                {selectedExecution.outputs && (
                  <section className="flex flex-col gap-1">
                    <p className="text-[10px] font-medium text-muted-foreground">输出</p>
                    <pre className="overflow-x-auto rounded-md bg-muted/50 p-2 text-[10px] text-foreground">
                      {JSON.stringify(selectedExecution.outputs, null, 2)}
                    </pre>
                  </section>
                )}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                选择一条运行记录
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  )
}

GlobalLogPanel.displayName = 'GlobalLogPanel'

export { GlobalLogPanel }
