import { useCallback, useState } from 'react'
import type { IDockviewPanelHeaderProps } from 'dockview'
import { Button, Popover, PopoverContent, PopoverTrigger, Separator } from '@eous/ui'
import { Grid2X2, Trash2 } from 'lucide-react'
import ComponentGrid from './component-grid.js'
import { getPanelTitle } from './panel-utils.js'
import type { PanelParams } from './types.js'
import { getViewEntry, type ViewType } from '../views/index.js'

export function WorkspaceTab(props: IDockviewPanelHeaderProps<PanelParams>) {
  const { api, params } = props
  const componentType = params.componentType
  const entry = componentType ? getViewEntry(componentType) : undefined
  const Icon = entry?.icon
  const [open, setOpen] = useState(false)

  const handleSelect = useCallback(
    (type: ViewType) => {
      const nextEntry = getViewEntry(type)
      api.updateParameters({
        componentType: type,
        viewState: nextEntry?.createDefaultState(),
      })
      api.setTitle(getPanelTitle(type))
      setOpen(false)
    },
    [api],
  )

  return (
    <div className="workspace-dock-tab">
      <div className="workspace-dock-tab-title">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              className="workspace-dock-tab-switch"
              aria-label="Switch panel component"
              title="Switch panel component"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              {Icon ? <Icon className="h-3.5 w-3.5" /> : <Grid2X2 className="h-3.5 w-3.5" />}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <div className="flex flex-col gap-3">
              <ComponentGrid selectedType={componentType} onSelect={handleSelect} />
              <Separator />
              <div className="flex">
                <Button
                  variant="outline"
                  size="xs"
                  className="h-10 w-10 rounded-md bg-card text-destructive hover:border-destructive/40 hover:bg-destructive/10"
                  aria-label="Remove panel"
                  title="Remove panel"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    api.close()
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <span>{api.title ?? getPanelTitle(componentType)}</span>
      </div>
    </div>
  )
}
