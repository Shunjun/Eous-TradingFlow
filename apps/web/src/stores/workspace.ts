import { create } from 'zustand'
import type { MosaicNode } from 'react-mosaic-component'

export interface PanelDef {
  id: string
  title: string
  component: string
}

interface WorkspaceState {
  layout: MosaicNode<string> | null
  panels: Record<string, PanelDef>
  loaded: boolean
  dirty: boolean

  loadLayout: () => Promise<void>
  saveLayout: () => Promise<void>
  setLayout: (node: MosaicNode<string> | null) => void
  registerPanel: (panel: PanelDef) => void
  removePanel: (id: string) => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

const DEFAULT_LAYOUT: MosaicNode<string> = 'welcome'

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  layout: null,
  panels: {},
  loaded: false,
  dirty: false,

  loadLayout: async () => {
    try {
      const res = await fetch('/api/workspace/layout', { credentials: 'include' })
      if (!res.ok) return
      const { layout } = (await res.json()) as { layout: MosaicNode<string> | null }
      set({
        layout: layout ?? DEFAULT_LAYOUT,
        loaded: true,
      })
    } catch {
      set({ layout: DEFAULT_LAYOUT, loaded: true })
    }
  },

  saveLayout: async () => {
    const { layout, dirty } = get()
    if (!dirty || !layout) return

    try {
      await fetch('/api/workspace/layout', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout }),
      })
      set({ dirty: false })
    } catch {
      // Will retry on next save
    }
  },

  setLayout: (node) => {
    set({ layout: node, dirty: true })

    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      get().saveLayout()
    }, 5000)
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
