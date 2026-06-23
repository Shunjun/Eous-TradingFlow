import { useCallback, useEffect, useRef, useState } from 'react'
import type { Node } from '@xyflow/react'
import type { WorkflowContextMenuState } from '../canvas/context-menu'

interface NodeSelectorPosition {
  x: number
  y: number
  flowPosition: { x: number; y: number }
}

interface UseWorkflowContextMenuParams {
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number }
  onSelectNode?: (nodeId: string | null) => void
}

function useWorkflowContextMenu({
  screenToFlowPosition,
  onSelectNode,
}: UseWorkflowContextMenuParams) {
  const [contextMenu, setContextMenu] = useState<WorkflowContextMenuState | null>(null)
  const [nodeSelectorOpen, setNodeSelectorOpen] = useState(false)
  const [nodeSelectorPosition, setNodeSelectorPosition] = useState<NodeSelectorPosition | null>(
    null,
  )
  const contextMenuRef = useRef<HTMLDivElement | null>(null)

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  const openNodeSelector = useCallback((menu: WorkflowContextMenuState) => {
    setContextMenu(null)
    setNodeSelectorPosition({
      x: menu.x,
      y: menu.y,
      flowPosition: menu.flowPosition,
    })
    setNodeSelectorOpen(true)
  }, [])

  const handlePaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation?.()
      const x = event.clientX
      const y = event.clientY
      setContextMenu({
        kind: 'pane',
        x,
        y,
        flowPosition: screenToFlowPosition({ x, y }),
      })
    },
    [screenToFlowPosition],
  )

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault()
      event.stopPropagation()
      setContextMenu({
        kind: 'node',
        nodeId: node.id,
        x: event.clientX,
        y: event.clientY,
        flowPosition: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      })
      onSelectNode?.(node.id)
    },
    [onSelectNode, screenToFlowPosition],
  )

  const handleNodeSelectorOpenChange = useCallback((open: boolean) => {
    setNodeSelectorOpen(open)
    if (!open) setNodeSelectorPosition(null)
  }, [])

  useEffect(() => {
    if (!contextMenu) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeContextMenu()
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      if (contextMenuRef.current?.contains(target)) return
      closeContextMenu()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('scroll', closeContextMenu, true)
    window.addEventListener('resize', closeContextMenu)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('scroll', closeContextMenu, true)
      window.removeEventListener('resize', closeContextMenu)
    }
  }, [closeContextMenu, contextMenu])

  return {
    contextMenu,
    contextMenuRef,
    nodeSelectorOpen,
    nodeSelectorPosition,
    closeContextMenu,
    openNodeSelector,
    handlePaneContextMenu,
    handleNodeContextMenu,
    handleNodeSelectorOpenChange,
  }
}

export { useWorkflowContextMenu }
export type { NodeSelectorPosition }
