import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DockviewReact,
  type DockviewApi,
  type DockviewReadyEvent,
  type SerializedDockview,
} from 'dockview'
import { useDashboardLayoutStore } from '../../stores/dashboard-layout.js'
import { LayoutToolbar } from './layout-toolbar.js'
import { addWorkspacePanel } from './panel-utils.js'
import { PANEL_COMPONENT, PANEL_TAB_COMPONENT } from './types.js'
import { WorkspaceHeaderActions } from './workspace-header-actions.js'
import { WorkspacePanel } from './workspace-panel.js'
import { WorkspaceTab } from './workspace-tab.js'
import { WorkspaceWatermark } from './workspace-watermark.js'

import 'dockview/dist/styles/dockview.css'
import './dockview.css'

export function WorkspaceLayout() {
  const dockviewLayout = useDashboardLayoutStore((s) => s.dockviewLayout)
  const { setDockviewLayout, resetDockviewLayoutBaseline, setLayoutCapture } =
    useDashboardLayoutStore.getState()
  const apiRef = useRef<DockviewApi | null>(null)
  const restoredLayoutRef = useRef<SerializedDockview | null | undefined>(undefined)
  const isRestoringRef = useRef(false)
  const [layoutVersion, setLayoutVersion] = useState(0)

  const components = useMemo(() => ({ [PANEL_COMPONENT]: WorkspacePanel }), [])
  const tabComponents = useMemo(() => ({ [PANEL_TAB_COMPONENT]: WorkspaceTab }), [])
  const restoreDockviewLayout = useCallback(
    (api: DockviewApi, layout: SerializedDockview | null) => {
      isRestoringRef.current = true
      api.clear()
      if (layout) {
        api.fromJSON(layout)
      } else {
        addWorkspacePanel(api, 'kline')
      }
      restoredLayoutRef.current = layout
      setLayoutVersion((value) => value + 1)
      queueMicrotask(() => {
        const restoredLayout = api.toJSON()
        restoredLayoutRef.current = restoredLayout
        resetDockviewLayoutBaseline(restoredLayout)
        isRestoringRef.current = false
      })
    },
    [resetDockviewLayoutBaseline],
  )

  const handleReady = useCallback(
    (event: DockviewReadyEvent) => {
      apiRef.current = event.api
      setLayoutCapture(() => event.api.toJSON())
      restoreDockviewLayout(event.api, dockviewLayout)

      event.api.onDidLayoutChange(() => {
        if (isRestoringRef.current) return
        const latestLayout = event.api.toJSON()
        restoredLayoutRef.current = latestLayout
        setDockviewLayout(latestLayout)
      })
      event.api.onDidActivePanelChange(() => {
        setLayoutVersion((value) => value + 1)
      })
      event.api.onDidMaximizedGroupChange(() => {
        setLayoutVersion((value) => value + 1)
      })
    },
    [dockviewLayout, restoreDockviewLayout, setDockviewLayout, setLayoutCapture],
  )

  useEffect(() => {
    const api = apiRef.current
    if (!api || restoredLayoutRef.current === dockviewLayout) return

    restoreDockviewLayout(api, dockviewLayout)
  }, [dockviewLayout, restoreDockviewLayout])

  useEffect(() => {
    return () => {
      setLayoutCapture(null)
    }
  }, [setLayoutCapture])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <LayoutToolbar />
      <div className="min-h-0 flex-1 overflow-hidden">
        <div
          className="workspace-dockview dockview-theme-dark h-full"
          data-layout-version={layoutVersion}
        >
          <DockviewReact
            components={components}
            tabComponents={tabComponents}
            defaultTabComponent={WorkspaceTab}
            rightHeaderActionsComponent={WorkspaceHeaderActions}
            watermarkComponent={WorkspaceWatermark}
            disableFloatingGroups
            onReady={handleReady}
          />
        </div>
      </div>
    </div>
  )
}
