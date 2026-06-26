import { useCallback, useEffect, useRef } from 'react'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup, cn } from '@eous/ui'
import { CanvasToolbar } from './canvas-toolbar'
import { FloatToolbar } from './float-toolbar'
import { GlobalLogPanel, SettingsPanel } from '../panels'
import { useWorkflowStore } from '../store/workflow-store'
import type { WorkflowEditEvent } from '@eous/api-client'

interface WorkflowOverlayProps {
  workflowId: string
  saving: boolean
  publishing: boolean
  snapshots: WorkflowEditEvent[]
  showWorkflowList?: boolean
  onPublish: () => void
  onBeforeRun?: () => Promise<unknown>
  onCreateSnapshot: () => void
  onRestoreSnapshot: (eventId: string) => void
  onWorkflowSelect?: (workflowId: string | null) => void
}

const LOG_COLLAPSED_SIZE = 0
const LOG_DEFAULT_OPEN_SIZE = '34%'
const LOG_MAX_OPEN_SIZE = '55%'
const LOG_MIN_OPEN_HEIGHT = 120
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
  snapshots,
  showWorkflowList,
  onPublish,
  onBeforeRun,
  onCreateSnapshot,
  onRestoreSnapshot,
  onWorkflowSelect,
}: WorkflowOverlayProps) {
  const logOpen = useWorkflowStore((state) => state.logOpen)
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
    logPanelElementRef.current?.style.setProperty(
      'min-height',
      logOpen ? `${LOG_MIN_OPEN_HEIGHT}px` : '0px',
    )

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
      logPanelElementRef.current?.style.removeProperty('min-height')
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
        snapshots={snapshots}
        showWorkflowList={showWorkflowList}
        onPublish={onPublish}
        onCreateSnapshot={onCreateSnapshot}
        onRestoreSnapshot={onRestoreSnapshot}
        onWorkflowSelect={onWorkflowSelect}
      />

      <div className="grid min-h-0 grid-cols-[1fr_auto] gap-3 overflow-x-hidden">
        <div className="relative min-h-0">
          <div className="absolute top-1/2 -translate-y-1/2 left-0">
            <CanvasToolbar />
          </div>
        </div>
        <SettingsPanel workflowId={workflowId} onBeforeRun={onBeforeRun} />
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
          <GlobalLogPanel workflowId={workflowId} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

WorkflowOverlay.displayName = 'WorkflowOverlay'

export { WorkflowOverlay }
export type { WorkflowOverlayProps }
