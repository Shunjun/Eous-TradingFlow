import { Handle, Position } from '@xyflow/react'
import { cn, Dot } from '@eous/ui'

interface BaseNodeProps {
  id: string
  color: string
  label: string
  status?: 'idle' | 'running' | 'completed' | 'failed'
  selected?: boolean
  preview?: { label: string; value: string }[]
}

const statusDotColor: Record<string, string> = {
  running: 'bg-primary',
  completed: 'bg-emerald-500',
  failed: 'bg-red-400',
}

function BaseNode({
  id,
  color,
  label,
  status = 'idle',
  selected = false,
  preview = [],
}: BaseNodeProps) {
  const lines = preview.slice(0, 3)

  return (
    <div
      className={cn(
        'w-52 rounded-lg border border-border bg-card shadow-sm',
        selected && 'ring-2 ring-primary',
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <div
          className="h-4 w-1 shrink-0 rounded-full bg-[color:var(--node-color)]"
          style={{ '--node-color': color } as React.CSSProperties}
        />
        <span className="truncate text-xs font-medium text-foreground">{label}</span>
        {status !== 'idle' && (
          <Dot
            size="xs"
            variant={status === 'running' ? 'pulse' : 'static'}
            className={cn('ml-auto', statusDotColor[status])}
          />
        )}
      </div>

      {lines.length > 0 && (
        <div className="border-t border-border px-3 py-1.5">
          {lines.map((line) => (
            <div key={line.label} className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[10px] text-muted-foreground">{line.label}</span>
              <span className="truncate font-mono text-[10px] tabular-nums text-muted-foreground">
                {line.value}
              </span>
            </div>
          ))}
        </div>
      )}

      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !rounded-full !border-2 !border-border !bg-background"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !rounded-full !border-2 !border-border !bg-background"
      />
    </div>
  )
}

BaseNode.displayName = 'BaseNode'

export { BaseNode }
export type { BaseNodeProps }
