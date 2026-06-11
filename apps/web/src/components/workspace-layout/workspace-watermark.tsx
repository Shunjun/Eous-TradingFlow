import type { IWatermarkPanelProps } from 'dockview'
import ComponentGrid from './component-grid.js'
import { addWorkspacePanel } from './panel-utils.js'

export function WorkspaceWatermark({ containerApi }: IWatermarkPanelProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <div className="text-center">
        <p className="text-lg font-medium text-foreground">No panels yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Select a component to get started</p>
      </div>
      <ComponentGrid onSelect={(type) => addWorkspacePanel(containerApi, type)} />
    </div>
  )
}
