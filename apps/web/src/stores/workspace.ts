import { create } from 'zustand'
import type { MosaicNode } from 'react-mosaic-component'
import { api } from '../lib/api.js'

export interface PanelDef {
  id: string
  title: string
  component: string
}

export interface LayoutMeta {
  id: string
  name: string
  updatedAt?: string
}

interface WorkspaceState {
  layouts: LayoutMeta[]
  activeLayoutId: string | null
  layout: MosaicNode<string> | null
  panels: Record<string, PanelDef>
  dirty: boolean
  loading: boolean
  saving: boolean

  loadAll: () => Promise<void>
  switchLayout: (id: string) => Promise<void>
  createLayout: (name: string) => Promise<{ id: string; name: string }>
  saveCurrentLayout: () => Promise<void>
  deleteLayout: (id: string) => Promise<void>
  setLayout: (node: MosaicNode<string> | null) => void
  registerPanel: (panel: PanelDef) => void
  removePanel: (id: string) => void
}

const DEFAULT_LAYOUT: MosaicNode<string> = 'welcome'

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  layouts: [],
  activeLayoutId: null,
  layout: null,
  panels: {},
  dirty: false,
  loading: true,
  saving: false,

  loadAll: async () => {
    try {
      set({ loading: true })
      const { layouts, activeLayoutId } = await api.listWorkspaceLayouts()

      if (!activeLayoutId && layouts.length === 0) {
        const created = await api.createWorkspaceLayout({ name: 'Default', setActive: true })
        set({
          layouts: [{ id: created.id, name: created.name }],
          activeLayoutId: created.id,
          layout: DEFAULT_LAYOUT,
          dirty: false,
          loading: false,
        })
        return
      }

      if (activeLayoutId) {
        const { layout: remote } = await api.getWorkspaceLayout(activeLayoutId)
        set({
          layouts,
          activeLayoutId,
          layout: (remote.schemaJson as MosaicNode<string>) ?? DEFAULT_LAYOUT,
          dirty: false,
          loading: false,
        })
      } else {
        set({
          layouts,
          activeLayoutId: null,
          layout: DEFAULT_LAYOUT,
          dirty: false,
          loading: false,
        })
      }
    } catch {
      set({ layout: DEFAULT_LAYOUT, loading: false })
    }
  },

  switchLayout: async (id) => {
    try {
      const { layout: remote } = await api.getWorkspaceLayout(id)
      set({
        activeLayoutId: id,
        layout: (remote.schemaJson as MosaicNode<string>) ?? DEFAULT_LAYOUT,
        dirty: false,
      })
    } catch {
      // silently fail
    }
  },

  createLayout: async (name) => {
    const created = await api.createWorkspaceLayout({ name, setActive: true })
    set((state) => ({
      layouts: [...state.layouts, { id: created.id, name: created.name }],
      activeLayoutId: created.id,
      layout: DEFAULT_LAYOUT,
      dirty: false,
    }))
    return created
  },

  saveCurrentLayout: async () => {
    const { activeLayoutId, layout, dirty } = get()
    if (!dirty || !activeLayoutId) return

    set({ saving: true })
    try {
      await api.saveWorkspaceLayout(activeLayoutId, { schemaJson: layout })
      set({ dirty: false })
    } catch {
      // Will retry on next save
    } finally {
      set({ saving: false })
    }
  },

  deleteLayout: async (id) => {
    const { newActiveLayoutId } = await api.deleteWorkspaceLayout(id)

    if (newActiveLayoutId) {
      await get().switchLayout(newActiveLayoutId)
      set((state) => ({
        layouts: state.layouts.filter((l) => l.id !== id),
      }))
    } else {
      set((state) => {
        const newLayouts = state.layouts.filter((l) => l.id !== id)
        return {
          layouts: newLayouts,
          activeLayoutId: newLayouts[0]?.id ?? null,
        }
      })
      if (get().activeLayoutId) {
        await get().switchLayout(get().activeLayoutId!)
      }
    }
  },

  setLayout: (node) => {
    set({ layout: node, dirty: true })
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
