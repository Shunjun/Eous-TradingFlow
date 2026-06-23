import { useCallback, useRef, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { cn } from '@eous/ui'
import { NodeSelector } from './node-selector'

interface NodeHandleProps {
  nodeId: string
  handleId: string
  type: 'source' | 'target'
  variant?: 'node' | 'detail'
  onAddConnectedNode?: (params: {
    sourceNodeId: string
    sourceHandle: string
    nodeType: string
  }) => void
}

const handleClassName = 'workflow-node-handle'

function NodeHandle({
  nodeId,
  handleId,
  type,
  variant = 'node',
  onAddConnectedNode,
}: NodeHandleProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null)
  const isSource = type === 'source'
  const position = isSource ? Position.Right : Position.Left

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    pointerDownRef.current = { x: event.clientX, y: event.clientY }
  }, [])

  const handlePointerUp = useCallback((event: React.PointerEvent) => {
    const pointerDown = pointerDownRef.current
    pointerDownRef.current = null
    if (!pointerDown) return

    const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y)
    if (moved > 4) return

    event.preventDefault()
    event.stopPropagation()
    setMenuOpen(true)
  }, [])

  const handle = (
    <Handle
      id={handleId}
      type={type}
      position={position}
      className={cn(handleClassName, variant === 'detail' && 'workflow-node-handle--detail')}
      style={variant === 'node' ? { top: 18 } : undefined}
      onPointerDown={isSource ? handlePointerDown : undefined}
      onPointerUp={isSource ? handlePointerUp : undefined}
    />
  )

  if (!isSource) return handle

  return (
    <NodeSelector
      open={menuOpen}
      onOpenChange={setMenuOpen}
      side="right"
      align="center"
      alignOffset={0}
      sideOffset={16}
      onSelectNode={(nodeType) =>
        onAddConnectedNode?.({ sourceNodeId: nodeId, sourceHandle: handleId, nodeType })
      }
    >
      {handle}
    </NodeSelector>
  )
}

export { NodeHandle }
export type { NodeHandleProps }
