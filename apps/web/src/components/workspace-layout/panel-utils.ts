import type { DockviewApi } from 'dockview'
import { getViewEntry, type ViewType } from '../views/index.js'
import { PANEL_COMPONENT, PANEL_TAB_COMPONENT, type PanelParams } from './types.js'

type PanelDirection = 'within' | 'right' | 'left' | 'above' | 'below'

function createPanelId() {
  return `panel-${crypto.randomUUID().slice(0, 8)}`
}

export function getPanelTitle(type?: ViewType) {
  return type ? (getViewEntry(type)?.label ?? type) : 'Empty Panel'
}

export function addWorkspacePanel(
  api: DockviewApi,
  type?: ViewType,
  referencePanel?: string,
  direction: PanelDirection = 'within',
) {
  const entry = type ? getViewEntry(type) : undefined
  api.addPanel<PanelParams>({
    id: createPanelId(),
    title: getPanelTitle(type),
    component: PANEL_COMPONENT,
    tabComponent: PANEL_TAB_COMPONENT,
    params: {
      componentType: type,
      viewState: entry?.createDefaultState(),
    },
    position: referencePanel
      ? {
          referencePanel,
          direction,
        }
      : undefined,
  })
}
