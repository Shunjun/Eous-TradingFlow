import { create } from 'zustand'
import type { SerializedDockview } from 'dockview'
import { api } from '../lib/api.js'

export interface LayoutMeta {
  id: string
  name: string
  updatedAt?: string
}

interface DashboardLayoutState {
  layouts: LayoutMeta[]
  activeLayoutId: string | null
  dockviewLayout: SerializedDockview | null
  savedDockviewLayout: SerializedDockview | null
  dirty: boolean
  loading: boolean
  saving: boolean
  captureDockviewLayout: (() => SerializedDockview | null) | null

  loadAll: () => Promise<void>
  switchLayout: (id: string) => Promise<void>
  createLayout: (name: string) => Promise<void>
  saveCurrentLayout: () => Promise<void>
  deleteLayout: (id: string) => Promise<void>
  setDockviewLayout: (layout: SerializedDockview | null) => void
  resetDockviewLayoutBaseline: (layout: SerializedDockview | null) => void
  setLayoutCapture: (capture: (() => SerializedDockview | null) | null) => void
}

function parseSchemaJson(raw: unknown): {
  dockviewLayout: SerializedDockview | null
} {
  try {
    let schema = raw as Record<string, unknown> | null | undefined
    if (typeof raw === 'string') {
      schema = JSON.parse(raw)
    }
    return {
      dockviewLayout: (schema?.dockviewLayout as SerializedDockview | null) ?? null,
    }
  } catch {
    return { dockviewLayout: null }
  }
}

function normalizeDockviewLayout(layout: SerializedDockview | null): unknown {
  if (!layout) return null
  return normalizeValue(layout)
}

function shouldIgnoreLayoutKey(path: string, key: string) {
  if ((key === 'width' || key === 'height') && path === 'grid') return true
  return key === 'activeGroup' || key === 'activeView' || key === 'title'
}

function normalizeValue(value: unknown, path = ''): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) => normalizeValue(item, `${path}.${index}`))
  }
  if (!value || typeof value !== 'object') return value

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !shouldIgnoreLayoutKey(path, key))
    .sort(([a], [b]) => a.localeCompare(b))

  return Object.fromEntries(
    entries.map(([key, item]) => [key, normalizeValue(item, path ? `${path}.${key}` : key)]),
  )
}

function areDockviewLayoutsEqual(a: SerializedDockview | null, b: SerializedDockview | null) {
  return JSON.stringify(normalizeDockviewLayout(a)) === JSON.stringify(normalizeDockviewLayout(b))
}

export const useDashboardLayoutStore = create<DashboardLayoutState>((set, get) => ({
  layouts: [],
  activeLayoutId: null,
  dockviewLayout: null,
  savedDockviewLayout: null,
  dirty: false,
  loading: true,
  saving: false,
  captureDockviewLayout: null,

  loadAll: async () => {
    set({ loading: true })
    try {
      const res = await api.listWorkspaceLayouts()
      const layouts = res.layouts as LayoutMeta[]
      const activeLayoutId = res.activeLayoutId as string | null

      if (layouts.length === 0 && !activeLayoutId) {
        // No layouts exist — create a default one
        const created = await api.createWorkspaceLayout({ name: 'Default', setActive: true })
        set({
          layouts: [{ id: created.id as string, name: created.name as string }],
          activeLayoutId: created.id as string,
          dockviewLayout: null,
          savedDockviewLayout: null,
          dirty: false,
          loading: false,
        })
        return
      }

      if (activeLayoutId) {
        try {
          const detail = await api.getWorkspaceLayout(activeLayoutId)
          const layoutDetail = detail.layout as {
            id: string
            name: string
            schemaJson: unknown
            updatedAt?: string
          }
          const { dockviewLayout } = parseSchemaJson(layoutDetail.schemaJson)
          set({
            layouts,
            activeLayoutId,
            dockviewLayout,
            savedDockviewLayout: dockviewLayout,
            dirty: false,
            loading: false,
          })
          return
        } catch {
          // Fall through to default
        }
      }

      set({
        layouts,
        activeLayoutId,
        dockviewLayout: null,
        savedDockviewLayout: null,
        dirty: false,
        loading: false,
      })
    } catch {
      set({ loading: false })
    }
  },

  switchLayout: async (id: string) => {
    const { dirty } = get()
    if (dirty) {
      if (!window.confirm('You have unsaved changes. Discard them?')) return
    }
    try {
      const detail = await api.getWorkspaceLayout(id)
      const layoutDetail = detail.layout as {
        id: string
        name: string
        schemaJson: unknown
        updatedAt?: string
      }
      const { dockviewLayout } = parseSchemaJson(layoutDetail.schemaJson)
      set({
        activeLayoutId: id,
        dockviewLayout,
        savedDockviewLayout: dockviewLayout,
        dirty: false,
      })
    } catch {
      // Keep the current layout visible if switching fails.
    }
  },

  createLayout: async (name: string) => {
    try {
      const res = await api.createWorkspaceLayout({ name, setActive: true })
      const id = res.id as string
      const layoutName = res.name as string
      set((state) => ({
        layouts: [...state.layouts, { id, name: layoutName }],
        activeLayoutId: id,
        dockviewLayout: null,
        savedDockviewLayout: null,
        dirty: false,
      }))
    } catch {
      // silent
    }
  },

  saveCurrentLayout: async () => {
    const { activeLayoutId, captureDockviewLayout, dockviewLayout } = get()
    if (!activeLayoutId) return
    const latestLayout = captureDockviewLayout?.() ?? dockviewLayout
    set({ saving: true })
    try {
      await api.saveWorkspaceLayout(activeLayoutId, {
        schemaJson: { dockviewLayout: latestLayout },
      })
      set({
        savedDockviewLayout: latestLayout,
        dirty: false,
        saving: false,
      })
    } catch {
      set({ saving: false })
    }
  },

  deleteLayout: async (id: string) => {
    try {
      const res = await api.deleteWorkspaceLayout(id)
      const newActiveId = (res as { newActiveLayoutId?: string }).newActiveLayoutId
      const layouts = get().layouts.filter((l) => l.id !== id)

      if (newActiveId) {
        const detail = await api.getWorkspaceLayout(newActiveId)
        const layoutDetail = detail.layout as {
          id: string
          name: string
          schemaJson: unknown
          updatedAt?: string
        }
        const { dockviewLayout } = parseSchemaJson(layoutDetail.schemaJson)
        set({
          layouts,
          activeLayoutId: newActiveId,
          dockviewLayout,
          savedDockviewLayout: dockviewLayout,
          dirty: false,
        })
        return
      }

      set({ layouts })
    } catch {
      // silent
    }
  },

  setDockviewLayout: (layout) => {
    set((state) => ({
      dockviewLayout: layout,
      dirty: !areDockviewLayoutsEqual(layout, state.savedDockviewLayout),
    }))
  },

  resetDockviewLayoutBaseline: (layout) => {
    set({ dockviewLayout: layout, savedDockviewLayout: layout, dirty: false })
  },

  setLayoutCapture: (capture) => {
    set({ captureDockviewLayout: capture })
  },
}))
