import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { CanvasInteractionMode } from '../canvas'
import { useWorkflowStore } from '../store/workflow-store'
import { getFlowViewportCenterPosition } from '../canvas/flow-position'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

interface UseKeyboardShortcutsParams {
  targetRef: RefObject<HTMLElement | null>
}

function useKeyboardShortcuts({ targetRef }: UseKeyboardShortcutsParams) {
  const { screenToFlowPosition } = useReactFlow()
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId)
  const canvasMode = useWorkflowStore((state) => state.canvasMode)
  const setCanvasMode = useWorkflowStore((state) => state.setCanvasMode)
  const undo = useWorkflowStore((state) => state.undo)
  const redo = useWorkflowStore((state) => state.redo)
  const copyNode = useWorkflowStore((state) => state.copyNode)
  const pasteNode = useWorkflowStore((state) => state.pasteNode)
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
    return getFlowViewportCenterPosition(screenToFlowPosition, targetRef.current)
  }, [screenToFlowPosition, targetRef])

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
        setCanvasMode('pan')
        return
      }

      const modKey = event.metaKey || event.ctrlKey
      if (!modKey) return

      const key = event.key.toLowerCase()
      if (key === 'z') {
        event.preventDefault()
        event.stopPropagation()
        if (event.shiftKey) {
          redo()
        } else {
          undo()
        }
        return
      }

      if (key === 'c' && selectedNodeIdRef.current) {
        event.preventDefault()
        event.stopPropagation()
        copyNode(selectedNodeIdRef.current)
        return
      }

      if (key === 'v') {
        event.preventDefault()
        event.stopPropagation()
        pasteNode(getViewportCenterPosition())
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return

      const previousMode = previousModeRef.current
      if (previousMode === null) return

      event.preventDefault()
      previousModeRef.current = null
      setCanvasMode(previousMode)
    }

    target.addEventListener('keydown', handleKeyDown)
    target.addEventListener('keyup', handleKeyUp)

    return () => {
      target.removeEventListener('keydown', handleKeyDown)
      target.removeEventListener('keyup', handleKeyUp)
    }
  }, [getViewportCenterPosition, copyNode, pasteNode, redo, setCanvasMode, targetRef, undo])
}

export { useKeyboardShortcuts }
