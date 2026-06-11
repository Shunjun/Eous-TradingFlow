import { useEffect, useState } from 'react'
import type { IDockviewHeaderActionsProps } from 'dockview'
import { Button } from '@eous/ui'
import { Maximize2, Minimize2, Plus, SplitSquareVertical, X } from 'lucide-react'
import { addWorkspacePanel } from './panel-utils.js'

export function WorkspaceHeaderActions({ activePanel, containerApi }: IDockviewHeaderActionsProps) {
  const [hasMaximizedGroup, setHasMaximizedGroup] = useState(() => containerApi.hasMaximizedGroup())

  useEffect(() => {
    setHasMaximizedGroup(containerApi.hasMaximizedGroup())
    return containerApi.onDidMaximizedGroupChange(() => {
      setHasMaximizedGroup(containerApi.hasMaximizedGroup())
    }).dispose
  }, [containerApi])

  return (
    <div className="workspace-dock-actions">
      <Button
        variant="ghost-icon"
        size="xs"
        className="h-6 w-6"
        title="Add empty panel"
        onClick={() => addWorkspacePanel(containerApi, undefined, activePanel?.id)}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost-icon"
        size="xs"
        className="h-6 w-6"
        disabled={!activePanel}
        title="Split right"
        onClick={() => {
          if (!activePanel) return
          addWorkspacePanel(containerApi, undefined, activePanel.id, 'right')
        }}
      >
        <SplitSquareVertical className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost-icon"
        size="xs"
        className="h-6 w-6"
        onClick={() => {
          if (hasMaximizedGroup) {
            containerApi.exitMaximizedGroup()
          } else if (activePanel) {
            containerApi.maximizeGroup(activePanel)
          }
        }}
      >
        {hasMaximizedGroup ? (
          <Minimize2 className="h-3.5 w-3.5" />
        ) : (
          <Maximize2 className="h-3.5 w-3.5" />
        )}
      </Button>
      <Button
        variant="ghost-icon"
        size="xs"
        className="h-6 w-6"
        disabled={!activePanel}
        onClick={() => activePanel?.api.close()}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
