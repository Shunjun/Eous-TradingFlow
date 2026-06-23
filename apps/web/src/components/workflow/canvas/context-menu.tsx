import {
  Clipboard,
  Copy,
  LayoutGrid,
  Lock,
  Play,
  Plus,
  Scissors,
  Scan,
  Trash2,
  Undo2,
  Unlock,
} from 'lucide-react'
import type { Node } from '@xyflow/react'
import { Separator, cn } from '@eous/ui'

interface WorkflowContextMenuState {
  kind: 'pane' | 'node'
  x: number
  y: number
  flowPosition: { x: number; y: number }
  nodeId?: string
}

interface WorkflowContextMenuProps {
  menu: WorkflowContextMenuState
  nodes: Node[]
  canUndo: boolean
  canRedo: boolean
  canPaste: boolean
  menuRef: React.RefObject<HTMLDivElement | null>
  onAddNode: () => void
  onAutoLayout: () => void
  onFitPorts: () => void
  onUndo: () => void
  onRedo: () => void
  onRunNode: (nodeId: string) => void
  onToggleLockNode: (nodeId: string) => void
  onCopyNode: (nodeId: string) => void
  onCutNode: (nodeId: string) => void
  onPasteNode: (position: { x: number; y: number }) => void
  onDuplicateNode: (nodeId: string) => void
  onDeleteNode: (nodeId: string) => void
  onClose: () => void
}

interface MenuItemProps {
  icon: React.ReactNode
  label: string
  disabled?: boolean
  onClick?: () => void
}

function MenuItem({ icon, label, disabled, onClick }: MenuItemProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-xs text-foreground outline-none transition hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
        disabled && 'cursor-not-allowed opacity-45 hover:bg-transparent hover:text-foreground',
      )}
      onClick={onClick}
    >
      <span className="flex size-3.5 shrink-0 items-center justify-center text-muted-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  )
}

function WorkflowContextMenu({
  menu,
  nodes,
  canUndo,
  canRedo,
  canPaste,
  menuRef,
  onAddNode,
  onAutoLayout,
  onFitPorts,
  onUndo,
  onRedo,
  onRunNode,
  onToggleLockNode,
  onCopyNode,
  onCutNode,
  onPasteNode,
  onDuplicateNode,
  onDeleteNode,
  onClose,
}: WorkflowContextMenuProps) {
  const targetNode = menu.nodeId ? nodes.find((node) => node.id === menu.nodeId) : null
  const locked = targetNode?.draggable === false

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-44 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
      style={{
        left: Math.min(menu.x, window.innerWidth - 188),
        top: Math.min(menu.y, window.innerHeight - 260),
      }}
      onContextMenu={(event) => event.preventDefault()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {menu.kind === 'pane' ? (
        <>
          <MenuItem icon={<Plus className="size-3.5" />} label="添加节点" onClick={onAddNode} />
          <MenuItem
            icon={<LayoutGrid className="size-3.5" />}
            label="自动布局"
            onClick={() => {
              onAutoLayout()
              onClose()
            }}
          />
          <MenuItem
            icon={<Scan className="size-3.5" />}
            label="适配端口"
            onClick={() => {
              onFitPorts()
              onClose()
            }}
          />
          <Separator className="my-1" />
          <MenuItem
            icon={<Undo2 className="size-3.5" />}
            label="撤销"
            disabled={!canUndo}
            onClick={() => {
              onUndo()
              onClose()
            }}
          />
          <MenuItem
            icon={<Undo2 className="size-3.5 rotate-180" />}
            label="重做"
            disabled={!canRedo}
            onClick={() => {
              onRedo()
              onClose()
            }}
          />
          <MenuItem
            icon={<Clipboard className="size-3.5" />}
            label="粘贴"
            disabled={!canPaste}
            onClick={() => {
              onPasteNode(menu.flowPosition)
              onClose()
            }}
          />
        </>
      ) : (
        <>
          <MenuItem
            icon={<Play className="size-3.5" />}
            label="运行"
            onClick={() => {
              if (menu.nodeId) onRunNode(menu.nodeId)
              onClose()
            }}
          />
          <MenuItem
            icon={locked ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
            label={locked ? '解锁' : '锁定'}
            onClick={() => {
              if (menu.nodeId) onToggleLockNode(menu.nodeId)
              onClose()
            }}
          />
          <Separator className="my-1" />
          <MenuItem
            icon={<Copy className="size-3.5" />}
            label="拷贝"
            onClick={() => {
              if (menu.nodeId) onCopyNode(menu.nodeId)
              onClose()
            }}
          />
          <MenuItem
            icon={<Scissors className="size-3.5" />}
            label="剪切"
            onClick={() => {
              if (menu.nodeId) onCutNode(menu.nodeId)
              onClose()
            }}
          />
          <MenuItem
            icon={<Clipboard className="size-3.5" />}
            label="粘贴"
            disabled={!canPaste}
            onClick={() => {
              onPasteNode({ x: menu.flowPosition.x + 32, y: menu.flowPosition.y + 32 })
              onClose()
            }}
          />
          <MenuItem
            icon={<Copy className="size-3.5" />}
            label="复制"
            onClick={() => {
              if (menu.nodeId) onDuplicateNode(menu.nodeId)
              onClose()
            }}
          />
          <Separator className="my-1" />
          <MenuItem
            icon={<Trash2 className="size-3.5" />}
            label="删除"
            onClick={() => {
              if (menu.nodeId) onDeleteNode(menu.nodeId)
              onClose()
            }}
          />
        </>
      )}
    </div>
  )
}

export { WorkflowContextMenu }
export type { WorkflowContextMenuState }
