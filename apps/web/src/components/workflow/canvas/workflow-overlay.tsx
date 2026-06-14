import { useCallback, useEffect, useRef } from 'react'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup, cn } from '@eous/ui'
import { CanvasToolbar, type CanvasInteractionMode } from './canvas-toolbar'
import { FloatToolbar } from './float-toolbar'
import { GlobalLogPanel } from './global-log-panel'
import { SettingsPanel } from '../panels'

interface WorkflowOverlayProps {
  workflowId: string
  saving: boolean
  publishing: boolean
  isLocalDraft: boolean
  logOpen: boolean
  showWorkflowList?: boolean
  canvasMode: CanvasInteractionMode
  selectedNode: {
    id: string
    type?: string
    data: Record<string, unknown>
  } | null
  onSave: () => void
  onPublish: () => void
  onToggleLog: () => void
  onWorkflowSelect?: (workflowId: string) => void
  onCanvasModeChange: (mode: CanvasInteractionMode) => void
  onSelectNodeType: (nodeType: string) => void
  onNodeDataChange: (data: Record<string, unknown>) => void
  onCloseSettings: () => void
}

const LOG_COLLAPSED_SIZE = 0
const LOG_DEFAULT_OPEN_SIZE = '34%'
const LOG_MAX_OPEN_SIZE = '55%'
const LOG_RESIZE_TRANSITION_MS = 220

interface ResizablePanelHandle {
  collapse: () => void
  expand: () => void
  getSize: () => {
    asPercentage: number
    inPixels: number
  }
  isCollapsed: () => boolean
  resize: (size: number | string) => void
}

function WorkflowOverlay({
  workflowId,
  saving,
  publishing,
  isLocalDraft,
  logOpen,
  showWorkflowList,
  canvasMode,
  selectedNode,
  onSave,
  onPublish,
  onToggleLog,
  onWorkflowSelect,
  onCanvasModeChange,
  onSelectNodeType,
  onNodeDataChange,
  onCloseSettings,
}: WorkflowOverlayProps) {
  const logPanelRef = useRef<ResizablePanelHandle | null>(null)
  const workspacePanelElementRef = useRef<HTMLDivElement | null>(null)
  const logPanelElementRef = useRef<HTMLDivElement | null>(null)
  const lastOpenLogSizeRef = useRef(LOG_DEFAULT_OPEN_SIZE)
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const transition = `flex ${LOG_RESIZE_TRANSITION_MS}ms cubic-bezier(0.16, 1, 0.3, 1), flex-basis ${LOG_RESIZE_TRANSITION_MS}ms cubic-bezier(0.16, 1, 0.3, 1), height ${LOG_RESIZE_TRANSITION_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`
    const panels = [workspacePanelElementRef.current, logPanelElementRef.current]

    for (const panel of panels) {
      panel?.style.setProperty('transition', transition)
    }

    logPanelRef.current?.resize(logOpen ? lastOpenLogSizeRef.current : LOG_COLLAPSED_SIZE)

    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current)
    transitionTimerRef.current = setTimeout(() => {
      for (const panel of panels) {
        panel?.style.removeProperty('transition')
      }
      transitionTimerRef.current = null
    }, LOG_RESIZE_TRANSITION_MS)

    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current)
        transitionTimerRef.current = null
      }
      for (const panel of panels) {
        panel?.style.removeProperty('transition')
      }
    }
  }, [logOpen])

  const handleLogResize = useCallback(
    (size: { asPercentage: number }) => {
      if (logOpen && size.asPercentage > LOG_COLLAPSED_SIZE) {
        lastOpenLogSizeRef.current = `${size.asPercentage}%`
      }
    },
    [logOpen],
  )

  const workspaceLayer = (
    <div className={cn('grid h-full w-full grid-rows-[auto_1fr] gap-3 p-3', logOpen && 'pb-2')}>
      <FloatToolbar
        saving={saving}
        publishing={publishing}
        isLocalDraft={isLocalDraft}
        logOpen={logOpen}
        showWorkflowList={showWorkflowList}
        onSave={onSave}
        onPublish={onPublish}
        onToggleLog={onToggleLog}
        onWorkflowSelect={onWorkflowSelect}
      />

      <div className="grid min-h-0 grid-cols-[1fr_auto] gap-3">
        <div className="relative min-h-0">
          <div className="absolute top-1/2 -translate-y-1/2 left-0">
            <CanvasToolbar
              mode={canvasMode}
              onModeChange={onCanvasModeChange}
              onSelectNode={onSelectNodeType}
            />
          </div>
        </div>
        <SettingsPanel
          workflowId={workflowId}
          nodeId={selectedNode?.id ?? null}
          nodeType={selectedNode?.type ?? null}
          data={selectedNode?.data ?? null}
          onChange={onNodeDataChange}
          onClose={onCloseSettings}
        />
      </div>
    </div>
  )

  return (
    <div className="pointer-events-none absolute inset-0 z-10 h-full w-full">
      <ResizablePanelGroup orientation="vertical" className="h-full w-full">
        <ResizablePanel elementRef={workspacePanelElementRef} defaultSize="94%" minSize="15%">
          {workspaceLayer}
        </ResizablePanel>
        <ResizableHandle
          withHandle={logOpen}
          className={cn('pointer-events-auto', !logOpen && 'opacity-0')}
          disabled={!logOpen}
        />
        <ResizablePanel
          panelRef={logPanelRef}
          elementRef={logPanelElementRef}
          defaultSize={LOG_COLLAPSED_SIZE}
          minSize={LOG_COLLAPSED_SIZE}
          maxSize={LOG_MAX_OPEN_SIZE}
          onResize={handleLogResize}
        >
          <GlobalLogPanel workflowId={workflowId} open={logOpen} onClose={onToggleLog} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

WorkflowOverlay.displayName = 'WorkflowOverlay'

export { WorkflowOverlay }
export type { WorkflowOverlayProps }
