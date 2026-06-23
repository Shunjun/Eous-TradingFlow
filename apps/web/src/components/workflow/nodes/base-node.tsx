import { useCallback, useRef, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Copy, Lock, Play, Trash2 } from 'lucide-react'
import { cn } from '@eous/ui'
import { NodeSelector } from './node-selector'

interface BaseNodeProps {
  id: string
  data: { color?: string; label?: string; status?: string }
  selected: boolean
  locked?: boolean
  hideHandles?: boolean
  onRun?: (id: string) => void
  onToggleLock?: (id: string) => void
  onDuplicate?: (id: string) => void
  onDelete?: (id: string) => void
  onAddConnectedNode?: (params: {
    sourceNodeId: string
    sourcePosition: 'left' | 'right'
    nodeType: string
  }) => void
  children: React.ReactNode
}

const handleClassName = 'workflow-node-handle'

function BaseNode({
  id,
  data,
  selected,
  locked,
  hideHandles,
  onRun,
  onToggleLock,
  onDuplicate,
  onDelete,
  onAddConnectedNode,
  children,
}: BaseNodeProps) {
  const [nodeMenuOpen, setNodeMenuOpen] = useState(false)
  const [activeHandlePosition, setActiveHandlePosition] = useState<'left' | 'right'>('right')
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null)

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    pointerDownRef.current = { x: event.clientX, y: event.clientY }
  }, [])

  const handleHandleClick = useCallback((event: React.MouseEvent, position: 'left' | 'right') => {
    const pointerDown = pointerDownRef.current
    pointerDownRef.current = null
    if (pointerDown) {
      const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y)
      if (moved > 4) return
    }

    event.preventDefault()
    event.stopPropagation()
    setActiveHandlePosition(position)
    setNodeMenuOpen(true)
  }, [])

  return (
    <div
      className={cn(
        'group relative rounded-[10px] border border-border bg-card shadow-[0_8px_22px_hsl(var(--background)/0.28)] transition-shadow duration-150',
        selected && 'border-primary/60 ring-2 ring-primary/30',
      )}
    >
      <div className="absolute -right-1 -top-8 z-20 flex translate-y-1 items-center gap-1 opacity-0 transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100">
        <button
          type="button"
          className="nodrag flex h-6 w-6 items-center justify-center rounded-md border border-border bg-popover/95 text-muted-foreground shadow-sm backdrop-blur hover:text-foreground"
          aria-label="运行节点"
          onClick={(event) => {
            event.stopPropagation()
            onRun?.(id)
          }}
        >
          <Play className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={cn(
            'nodrag flex h-6 w-6 items-center justify-center rounded-md border border-border bg-popover/95 text-muted-foreground shadow-sm backdrop-blur hover:text-foreground',
            locked && 'border-primary/50 bg-primary/10 text-primary',
          )}
          aria-label="锁定节点"
          onClick={(event) => {
            event.stopPropagation()
            onToggleLock?.(id)
          }}
        >
          <Lock className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="nodrag flex h-6 w-6 items-center justify-center rounded-md border border-border bg-popover/95 text-muted-foreground shadow-sm backdrop-blur hover:text-foreground"
          aria-label="复制节点"
          onClick={(event) => {
            event.stopPropagation()
            onDuplicate?.(id)
          }}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="nodrag flex h-6 w-6 items-center justify-center rounded-md border border-border bg-popover/95 text-muted-foreground shadow-sm backdrop-blur hover:text-destructive"
          aria-label="删除节点"
          onClick={(event) => {
            event.stopPropagation()
            onDelete?.(id)
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {children}
      {!hideHandles && (
        <>
          <NodeSelector
            open={nodeMenuOpen && activeHandlePosition === 'left'}
            onOpenChange={(open) => {
              setActiveHandlePosition('left')
              setNodeMenuOpen(open)
            }}
            side="left"
            align="center"
            alignOffset={0}
            sideOffset={16}
            onSelectNode={(nodeType) =>
              onAddConnectedNode?.({ sourceNodeId: id, sourcePosition: 'left', nodeType })
            }
          >
            <Handle
              type="target"
              position={Position.Left}
              className={handleClassName}
              onPointerDown={handlePointerDown}
              onClick={(event) => handleHandleClick(event, 'left')}
            />
          </NodeSelector>
          <NodeSelector
            open={nodeMenuOpen && activeHandlePosition === 'right'}
            onOpenChange={(open) => {
              setActiveHandlePosition('right')
              setNodeMenuOpen(open)
            }}
            side="right"
            align="center"
            alignOffset={0}
            sideOffset={16}
            onSelectNode={(nodeType) =>
              onAddConnectedNode?.({ sourceNodeId: id, sourcePosition: 'right', nodeType })
            }
          >
            <Handle
              type="source"
              position={Position.Right}
              className={handleClassName}
              onPointerDown={handlePointerDown}
              onClick={(event) => handleHandleClick(event, 'right')}
            />
          </NodeSelector>
        </>
      )}
    </div>
  )
}

BaseNode.displayName = 'BaseNode'

export { BaseNode }
export type { BaseNodeProps }
