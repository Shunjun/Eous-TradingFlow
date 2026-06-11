import type { SerializableViewState, ViewType } from '../views/index.js'

export type PanelParams = {
  componentType?: ViewType
  viewState?: SerializableViewState
}

export const PANEL_COMPONENT = 'workspace-panel'
export const PANEL_TAB_COMPONENT = 'workspace-tab'
