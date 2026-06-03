import { create } from 'zustand'
import type { MosaicNode } from 'react-mosaic-component'
import { createSyncActions } from '../create-sync-actions'

export interface PanelDef {
  id: string
  title: string
  component: string
}

export interface WorkspaceState {
  layout: MosaicNode<string> | null
  panels: Record<string, PanelDef>

  load: () => Promise<void>
  save: () => Promise<void>
  setLayout: (node: MosaicNode<string> | null) => void
  registerPanel: (panel: PanelDef) => void
  removePanel: (id: string) => void
  markDirty: () => void
  cleanup: () => void
  loaded: boolean
  dirty: boolean
}

const DEFAULT_LAYOUT: MosaicNode<string> = 'welcome'

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  layout: null,
  panels: {},

  ...createSyncActions<WorkspaceState>(set, get, {
    endpoint: '/api/workspace/layout',
    serialize: (state) => ({ layout: state.layout }),
    deserialize: (raw: any) => ({
      layout: raw.layout ?? DEFAULT_LAYOUT,
      panels: raw.panels ?? {},
    }),
  }),

  setLayout: (node) => {
    set({ layout: node })
    get().markDirty()
  },

  registerPanel: (panel) => {
    set((state) => ({
      panels: { ...state.panels, [panel.id]: panel },
    }))
  },

  removePanel: (id) => {
    set((state) => {
      const { [id]: _, ...rest } = state.panels
      return { panels: rest }
    })
  },
}))
