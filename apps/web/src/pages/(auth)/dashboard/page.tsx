import { useCallback, useEffect, useState } from 'react'
import { Mosaic, MosaicWindow, type MosaicNode } from 'react-mosaic-component'
import 'react-mosaic-component/react-mosaic-component.css'
import { Button, Skeleton, Tabs, TabsList, TabsTrigger } from '@eous/ui'
import { Plus } from 'lucide-react'
import { useWorkspaceStore } from '../../../stores/workspace.js'
import WelcomeContent from '../../../components/dashboard/WelcomeContent.js'
import PlaceholderPanel from '../../../components/dashboard/PlaceholderPanel.js'
import ToolbarControls from '../../../components/dashboard/ToolbarControls.js'
import ZeroState from '../../../components/dashboard/ZeroState.js'

export default function DashboardPage() {
  const layout = useWorkspaceStore((s) => s.layout)
  const loading = useWorkspaceStore((s) => s.loading)
  const layouts = useWorkspaceStore((s) => s.layouts)
  const activeLayoutId = useWorkspaceStore((s) => s.activeLayoutId)
  const dirty = useWorkspaceStore((s) => s.dirty)
  const saving = useWorkspaceStore((s) => s.saving)
  const setLayout = useWorkspaceStore((s) => s.setLayout)
  const loadAll = useWorkspaceStore((s) => s.loadAll)
  const switchLayout = useWorkspaceStore((s) => s.switchLayout)
  const createLayout = useWorkspaceStore((s) => s.createLayout)
  const saveCurrentLayout = useWorkspaceStore((s) => s.saveCurrentLayout)

  const [panelCount, setPanelCount] = useState(1)

  useEffect(() => {
    loadAll()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSwitch = useCallback(
    (id: string) => {
      if (id === activeLayoutId) return
      if (dirty && !window.confirm('有未保存的更改，放弃？')) return
      switchLayout(id)
    },
    [activeLayoutId, dirty, switchLayout],
  )

  const handleNewLayout = useCallback(() => {
    const name = `Layout ${layouts.length + 1}`
    createLayout(name)
  }, [layouts.length, createLayout])

  const handleSave = useCallback(() => {
    saveCurrentLayout()
  }, [saveCurrentLayout])

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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="w-full max-w-md space-y-3">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
        <div className="flex items-center gap-1">
          <Tabs value={activeLayoutId ?? undefined} onValueChange={handleSwitch}>
            <TabsList variant="line" className="h-7">
              {layouts.map((l) => (
                <TabsTrigger key={l.id} value={l.id} className="text-xs px-2 py-0.5 h-6">
                  {l.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNewLayout}>
            <Plus size={14} />
          </Button>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant={dirty ? 'accent-outline' : 'ghost'}
            size="sm"
            onClick={handleSave}
            disabled={!dirty || saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="accent-outline" size="sm" onClick={handleAddPanel}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Panel
          </Button>
        </div>
      </div>

      {/* Mosaic area */}
      <div className="flex-1 min-h-0 p-2">
        <Mosaic<string>
          value={layout}
          onChange={(node: MosaicNode<string> | null) => setLayout(node)}
          zeroStateView={<ZeroState />}
          renderTile={(id, path) => (
            <MosaicWindow<string>
              path={path}
              title={id === 'welcome' ? 'Welcome' : id}
              createNode={() => `panel-${crypto.randomUUID().slice(0, 8)}`}
              toolbarControls={
                <ToolbarControls tileId={id} currentLayout={layout} onLayoutChange={setLayout} />
              }
            >
              {id === 'welcome' ? <WelcomeContent /> : <PlaceholderPanel title={id} />}
            </MosaicWindow>
          )}
        />
      </div>
    </div>
  )
}
