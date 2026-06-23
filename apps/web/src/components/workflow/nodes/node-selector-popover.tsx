import type { NodeSelectorPosition } from '../hooks'
import { NodeSelector } from './node-selector'

interface WorkflowNodeSelectorPopoverProps {
  open: boolean
  position: NodeSelectorPosition
  onOpenChange: (open: boolean) => void
  onSelectNode: (nodeType: string) => void
}

function WorkflowNodeSelectorPopover({
  open,
  position,
  onOpenChange,
  onSelectNode,
}: WorkflowNodeSelectorPopoverProps) {
  return (
    <NodeSelector
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      align="start"
      sideOffset={0}
      alignOffset={0}
      onSelectNode={onSelectNode}
    >
      <button
        type="button"
        aria-label="添加节点"
        className="fixed z-50 size-px opacity-0"
        style={{
          left: Math.min(position.x, window.innerWidth - 236),
          top: Math.min(position.y, window.innerHeight - 372),
        }}
      />
    </NodeSelector>
  )
}

export { WorkflowNodeSelectorPopover }
