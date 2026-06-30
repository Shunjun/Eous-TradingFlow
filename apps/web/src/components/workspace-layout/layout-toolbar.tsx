import { useCallback, useState } from 'react'
import { Button, ConfirmDialog, cn } from '@eous/ui'
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
  const [pendingSwitchLayoutId, setPendingSwitchLayoutId] = useState<string | null>(null)
  const [pendingDeleteLayoutId, setPendingDeleteLayoutId] = useState<string | null>(null)
  const pendingDeleteLayout = layouts.find((item) => item.id === pendingDeleteLayoutId)

  const handleLayoutSwitch = useCallback(
    (id: string) => {
      if (id === activeLayoutId) return
      if (dirty) {
        setPendingSwitchLayoutId(id)
        return
      }
      switchLayout(id)
    },
    [activeLayoutId, dirty, switchLayout],
  )

  const confirmLayoutSwitch = useCallback(() => {
    if (!pendingSwitchLayoutId) return
    switchLayout(pendingSwitchLayoutId)
    setPendingSwitchLayoutId(null)
  }, [pendingSwitchLayoutId, switchLayout])

  const handleCreateLayout = useCallback(() => {
    createLayout(`Layout ${layouts.length + 1}`)
  }, [layouts.length, createLayout])

  const handleDeleteLayout = useCallback(
    (id: string) => {
      if (layouts.length <= 1) return
      setPendingDeleteLayoutId(id)
    },
    [layouts.length],
  )

  return (
    <>
      <div className="flex h-10 items-center justify-between border-b px-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {layouts.map((l) => (
              <div key={l.id} className="flex items-center">
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'h-7 rounded-r-none px-2.5 font-mono text-xs',
                    activeLayoutId === l.id && 'border-primary/50 bg-primary/10 text-primary',
                  )}
                  onClick={() => handleLayoutSwitch(l.id)}
                >
                  {l.name}
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  className="h-7 w-7 rounded-l-none border-l-0 px-0 text-muted-foreground hover:text-destructive"
                  disabled={layouts.length <= 1}
                  title={layouts.length <= 1 ? 'Cannot delete the last layout' : `Delete ${l.name}`}
                  onClick={() => handleDeleteLayout(l.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <Button variant="ghost-icon" size="xs" className="h-7 w-7" onClick={handleCreateLayout}>
            <Plus />
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
      <ConfirmDialog
        open={pendingSwitchLayoutId !== null}
        onOpenChange={(open) => !open && setPendingSwitchLayoutId(null)}
        title="Discard unsaved changes?"
        description="Switching layouts will discard the changes that have not been saved."
        confirmLabel="Discard"
        onConfirm={confirmLayoutSwitch}
      />
      <ConfirmDialog
        open={pendingDeleteLayoutId !== null}
        onOpenChange={(open) => !open && setPendingDeleteLayoutId(null)}
        title={`Delete layout "${pendingDeleteLayout?.name ?? 'current layout'}"?`}
        description="This layout will be removed from your workspace."
        confirmLabel="Delete"
        onConfirm={() => {
          if (!pendingDeleteLayoutId) return
          deleteLayout(pendingDeleteLayoutId)
          setPendingDeleteLayoutId(null)
        }}
      />
    </>
  )
}
