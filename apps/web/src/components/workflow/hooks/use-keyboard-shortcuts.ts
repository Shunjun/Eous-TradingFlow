import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { CanvasInteractionMode } from '../canvas'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

interface UseKeyboardShortcutsParams {
  targetRef: RefObject<HTMLElement | null>
  selectedNodeId: string | null
  canvasMode: CanvasInteractionMode
  onCanvasModeChange: (mode: CanvasInteractionMode) => void
  onUndo: () => void
  onRedo: () => void
  onCopyNode: (nodeId: string) => void
  onPasteNode: (position?: { x: number; y: number }) => void
}

function useKeyboardShortcuts({
  targetRef,
  selectedNodeId,
  canvasMode,
  onCanvasModeChange,
  onUndo,
  onRedo,
  onCopyNode,
  onPasteNode,
}: UseKeyboardShortcutsParams) {
  const { screenToFlowPosition } = useReactFlow()
  const selectedNodeIdRef = useRef(selectedNodeId)
  const canvasModeRef = useRef(canvasMode)
  const previousModeRef = useRef<CanvasInteractionMode | null>(null)

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId
  }, [selectedNodeId])

  useEffect(() => {
    canvasModeRef.current = canvasMode
  }, [canvasMode])

  const getViewportCenterPosition = useCallback(() => {
    return screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
  }, [screenToFlowPosition])

  useEffect(() => {
    const target = targetRef.current
    if (!target) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return

      if (event.code === 'Space' && !event.repeat) {
        event.preventDefault()
        if (previousModeRef.current === null) {
          previousModeRef.current = canvasModeRef.current
        }
        onCanvasModeChange('pan')
        return
      }

      const modKey = event.metaKey || event.ctrlKey
      if (!modKey) return

      const key = event.key.toLowerCase()
      if (key === 'z') {
        event.preventDefault()
        event.stopPropagation()
        if (event.shiftKey) {
          onRedo()
        } else {
          onUndo()
        }
        return
      }

      if (key === 'c' && selectedNodeIdRef.current) {
        event.preventDefault()
        event.stopPropagation()
        onCopyNode(selectedNodeIdRef.current)
        return
      }

      if (key === 'v') {
        event.preventDefault()
        event.stopPropagation()
        onPasteNode(getViewportCenterPosition())
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return

      const previousMode = previousModeRef.current
      if (previousMode === null) return

      event.preventDefault()
      previousModeRef.current = null
      onCanvasModeChange(previousMode)
    }

    target.addEventListener('keydown', handleKeyDown)
    target.addEventListener('keyup', handleKeyUp)

    return () => {
      target.removeEventListener('keydown', handleKeyDown)
      target.removeEventListener('keyup', handleKeyUp)
    }
  }, [
    getViewportCenterPosition,
    onCanvasModeChange,
    onCopyNode,
    onPasteNode,
    onRedo,
    onUndo,
    targetRef,
  ])
}

export { useKeyboardShortcuts }
