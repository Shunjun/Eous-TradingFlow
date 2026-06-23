import { Loader2 } from 'lucide-react'
import { Badge, cn } from '@eous/ui'
import type { NodeExecution } from '../hooks'

interface SettingsExecutionHistoryProps {
  loading: boolean
  execution: NodeExecution | null
}

function statusLabel(status: string) {
  if (status === 'succeeded') return '成功'
  if (status === 'failed') return '失败'
  return status
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="flex flex-col gap-1.5">
      <p className="text-[10px] font-medium text-muted-foreground">{title}</p>
      <pre className="max-h-56 overflow-auto rounded-md border border-border bg-muted/30 p-2 text-[10px] leading-relaxed text-foreground">
        {JSON.stringify(value, null, 2)}
      </pre>
    </section>
  )
}

function SettingsExecutionHistory({ loading, execution }: SettingsExecutionHistoryProps) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!execution) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-xs text-muted-foreground">
        暂无运行记录
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-3">
      <div className="flex items-center gap-2 rounded-md border border-border bg-background/60 px-3 py-2">
        <Badge variant={execution.status === 'succeeded' ? 'default' : 'destructive'}>
          {statusLabel(execution.status)}
        </Badge>
        {execution.durationMs != null && (
          <span className="text-[10px] text-muted-foreground">{execution.durationMs}ms</span>
        )}
        {execution.error && (
          <span className="min-w-0 truncate text-[10px] text-destructive">{execution.error}</span>
        )}
      </div>

      {execution.inputs && <JsonBlock title="输入" value={execution.inputs} />}
      {execution.outputs && <JsonBlock title="输出" value={execution.outputs} />}

      {execution.logs.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <p className="text-[10px] font-medium text-muted-foreground">日志</p>
          <div className="overflow-hidden rounded-md border border-border bg-background/60">
            {execution.logs.map((log, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-2 border-b border-border/70 px-2 py-1.5 text-[10px] last:border-b-0',
                  log.level === 'error' && 'bg-destructive/5',
                )}
              >
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
                <span className="min-w-0 text-foreground">{log.message}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export { SettingsExecutionHistory }
export type { SettingsExecutionHistoryProps }
