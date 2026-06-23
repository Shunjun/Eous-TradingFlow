import { Copy, Lock, Play, Trash2 } from 'lucide-react'
import { Button, cn } from '@eous/ui'

interface BaseNodeProps {
  id: string
  data: { color?: string; label?: string; status?: string }
  selected: boolean
  locked?: boolean
  onRun?: (id: string) => void
  onToggleLock?: (id: string) => void
  onDuplicate?: (id: string) => void
  onDelete?: (id: string) => void
  children: React.ReactNode
}

const actionButtonClassName =
  'nodrag h-6 w-6 border border-border bg-popover/95 p-0 text-muted-foreground shadow-sm backdrop-blur hover:bg-popover hover:text-foreground'

interface NodeActionButtonProps {
  label: string
  active?: boolean
  destructive?: boolean
  onClick?: () => void
  children: React.ReactNode
}

function NodeActionButton({
  label,
  active,
  destructive,
  onClick,
  children,
}: NodeActionButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost-icon"
      size="xs"
      className={cn(
        actionButtonClassName,
        active && 'border-primary/50 bg-primary/10 text-primary hover:text-primary',
        destructive && 'hover:text-destructive',
      )}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.()
      }}
    >
      {children}
    </Button>
  )
}

function BaseNode({
  id,
  data,
  selected,
  locked,
  onRun,
  onToggleLock,
  onDuplicate,
  onDelete,
  children,
}: BaseNodeProps) {
  return (
    <div
      className={cn(
        'group relative rounded-[10px] border border-border bg-card shadow-[0_8px_22px_hsl(var(--background)/0.28)] transition-shadow duration-150',
        selected && 'border-primary/60 ring-2 ring-primary/30',
      )}
    >
      <div className="absolute -right-1 -top-8 z-20 flex translate-y-1 items-center gap-1 opacity-0 transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100">
        <NodeActionButton label="运行节点" onClick={() => onRun?.(id)}>
          <Play className="h-3.5 w-3.5" />
        </NodeActionButton>
        <NodeActionButton label="锁定节点" active={locked} onClick={() => onToggleLock?.(id)}>
          <Lock className="h-3.5 w-3.5" />
        </NodeActionButton>
        <NodeActionButton label="复制节点" onClick={() => onDuplicate?.(id)}>
          <Copy className="h-3.5 w-3.5" />
        </NodeActionButton>
        <NodeActionButton label="删除节点" destructive onClick={() => onDelete?.(id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </NodeActionButton>
      </div>
      {children}
    </div>
  )
}

BaseNode.displayName = 'BaseNode'

export { BaseNode }
export type { BaseNodeProps }
