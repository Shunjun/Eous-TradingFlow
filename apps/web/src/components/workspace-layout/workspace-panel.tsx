import { useCallback, useEffect } from 'react'
import type { IDockviewPanelProps } from 'dockview'
import ComponentGrid from './component-grid.js'
import { getPanelTitle } from './panel-utils.js'
import type { PanelParams } from './types.js'
import { getViewEntry, type SerializableViewState, type ViewRegistryEntry } from '../views/index.js'

export function WorkspacePanel(props: IDockviewPanelProps<PanelParams>) {
  const { api, params } = props
  const componentType = params.componentType
  const entry = componentType ? getViewEntry(componentType) : undefined

  if (entry) {
    return (
      <RegisteredWorkspaceView
        key={entry.type}
        api={api}
        entry={entry}
        initialState={params.viewState}
      />
    )
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-4">
      <p className="text-sm text-muted-foreground">Select a component for this panel</p>
      <ComponentGrid
        onSelect={(type) => {
          const nextEntry = getViewEntry(type)
          api.updateParameters({
            componentType: type,
            viewState: nextEntry?.createDefaultState(),
          })
          api.setTitle(getPanelTitle(type))
        }}
      />
    </div>
  )
}

function RegisteredWorkspaceView({
  api,
  entry,
  initialState,
}: {
  api: IDockviewPanelProps<PanelParams>['api']
  entry: ViewRegistryEntry
  initialState: unknown
}) {
  const handleViewStateChange = useCallback(
    (viewState: SerializableViewState) => {
      api.updateParameters({ viewState })
    },
    [api],
  )

  const view = entry.useViewState(initialState, handleViewStateChange)
  const ViewComponent = entry.Component

  useEffect(() => {
    if (api.title === view.title) return
    api.setTitle(view.title)
  }, [api, view.title])

  return <ViewComponent {...view.props} />
}
