import { useCallback, useEffect, useState } from 'react'
import { Mosaic, MosaicWindow, type MosaicNode } from 'react-mosaic-component'
import 'react-mosaic-component/react-mosaic-component.css'
import { Button } from '@eous/ui'
import { Plus } from 'lucide-react'
import { useWorkspaceStore } from '../../../stores/workspace.js'
import WelcomeContent from '../../../components/dashboard/WelcomeContent.js'
import PlaceholderPanel from '../../../components/dashboard/PlaceholderPanel.js'
import ToolbarControls from '../../../components/dashboard/ToolbarControls.js'
import ZeroState from '../../../components/dashboard/ZeroState.js'

export default function DashboardPage() {
  const layout = useWorkspaceStore((s) => s.layout)
  const loaded = useWorkspaceStore((s) => s.loaded)
  const setLayout = useWorkspaceStore((s) => s.setLayout)
  const saveLayout = useWorkspaceStore((s) => s.saveLayout)
  const dirty = useWorkspaceStore((s) => s.dirty)
  const loadLayout = useWorkspaceStore((s) => s.loadLayout)

  const [panelCount, setPanelCount] = useState(1)

  useEffect(() => {
    loadLayout()
    return () => {
      if (dirty) saveLayout()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddPanel = useCallback(() => {
    const current = useWorkspaceStore.getState().layout
    if (!current) return

    const newId = `panel-${panelCount + 1}`
    const newLayout: MosaicNode<string> = {
      direction: 'row',
      first: current,
      second: newId,
    }
    setPanelCount((c) => c + 1)
    setLayout(newLayout)
  }, [panelCount, setLayout])

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading workspace…</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 pt-4 pb-2 shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-xs font-mono text-muted-foreground mt-0.5">Customizable workspace</p>
        </div>
        <Button variant="accent-outline" size="sm" onClick={handleAddPanel}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Panel
        </Button>
      </div>
      <div className="flex-1 min-h-0 px-4 pb-4">
        <Mosaic<string>
          value={layout}
          onChange={(node: MosaicNode<string> | null) => setLayout(node)}
          onRelease={(node: MosaicNode<string> | null) => {
            if (node) {
              setLayout(node)
              saveLayout()
            }
          }}
          zeroStateView={<ZeroState />}
          renderTile={(id, path) => (
            <MosaicWindow<string>
              path={path}
              title={id === 'welcome' ? 'Welcome' : id}
              createNode={() => `panel-${crypto.randomUUID().slice(0, 8)}`}
              toolbarControls={<ToolbarControls />}
            >
              {id === 'welcome' ? <WelcomeContent /> : <PlaceholderPanel title={id} />}
            </MosaicWindow>
          )}
        />
      </div>
    </div>
  )
}
