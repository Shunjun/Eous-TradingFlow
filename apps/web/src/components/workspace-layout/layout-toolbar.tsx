import { useCallback } from 'react'
import { Button, ToggleGroup, ToggleGroupItem } from '@eous/ui'
import { Plus, Save, Trash2 } from 'lucide-react'
import { useDashboardLayoutStore } from '../../stores/dashboard-layout.js'

export function LayoutToolbar() {
  const layouts = useDashboardLayoutStore((s) => s.layouts)
  const activeLayoutId = useDashboardLayoutStore((s) => s.activeLayoutId)
  const dirty = useDashboardLayoutStore((s) => s.dirty)
  const saving = useDashboardLayoutStore((s) => s.saving)
  const switchLayout = useDashboardLayoutStore((s) => s.switchLayout)
  const createLayout = useDashboardLayoutStore((s) => s.createLayout)
  const deleteLayout = useDashboardLayoutStore((s) => s.deleteLayout)
  const saveCurrentLayout = useDashboardLayoutStore((s) => s.saveCurrentLayout)

  const handleLayoutSwitch = useCallback(
    (id: string) => {
      if (id === activeLayoutId) return
      switchLayout(id)
    },
    [activeLayoutId, switchLayout],
  )

  const handleCreateLayout = useCallback(() => {
    createLayout(`Layout ${layouts.length + 1}`)
  }, [layouts.length, createLayout])

  const handleDeleteLayout = useCallback(() => {
    if (!activeLayoutId || layouts.length <= 1) return
    const activeLayout = layouts.find((layout) => layout.id === activeLayoutId)
    const name = activeLayout?.name ?? 'current layout'
    if (!window.confirm(`Delete layout "${name}"?`)) return
    deleteLayout(activeLayoutId)
  }, [activeLayoutId, deleteLayout, layouts])

  return (
    <div className="flex h-10 items-center justify-between border-b px-3">
      <div className="flex items-center gap-2">
        <ToggleGroup
          type="single"
          value={activeLayoutId ?? ''}
          onValueChange={(val) => val && handleLayoutSwitch(val)}
          spacing={1}
        >
          {layouts.map((l) => (
            <ToggleGroupItem
              key={l.id}
              value={l.id}
              variant="outline"
              size="sm"
              className="h-7 px-2.5 font-mono text-xs"
            >
              {l.name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button variant="ghost-icon" size="xs" className="h-7 w-7" onClick={handleCreateLayout}>
          <Plus />
        </Button>
        <Button
          variant="ghost-icon"
          size="xs"
          className="h-7 w-7 text-destructive hover:text-destructive"
          disabled={!activeLayoutId || layouts.length <= 1}
          title={layouts.length <= 1 ? 'Cannot delete the last layout' : 'Delete current layout'}
          onClick={handleDeleteLayout}
        >
          <Trash2 />
        </Button>
      </div>
      <Button
        variant={dirty ? 'accent-outline' : 'outline'}
        size="sm"
        className="h-7 gap-1.5 font-mono text-xs"
        disabled={!dirty || saving}
        onClick={saveCurrentLayout}
      >
        <Save className="h-3.5 w-3.5" />
        {saving ? 'Saving...' : 'Save'}
      </Button>
    </div>
  )
}
