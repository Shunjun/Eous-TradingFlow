import { create } from 'zustand'
import { createSyncActions } from '../create-sync-actions'
import type { IndicatorConfig } from '../types'

export interface IndicatorState {
  configsBySymbol: Record<string, IndicatorConfig[]>

  loaded: boolean
  dirty: boolean
  load: () => Promise<void>
  save: () => Promise<void>
  markDirty: () => void
  cleanup: () => void

  setConfigsForSymbol: (symbol: string, configs: IndicatorConfig[]) => void
  addConfigForSymbol: (symbol: string, config: IndicatorConfig) => void
  updateConfigForSymbol: (symbol: string, id: string, updates: Partial<IndicatorConfig>) => void
  removeConfigForSymbol: (symbol: string, id: string) => void
}

export const useIndicatorStore = create<IndicatorState>((set, get) => ({
  configsBySymbol: {},

  ...createSyncActions<IndicatorState>(set, get, {
    endpoint: '/api/indicators',
    serialize: (state) => ({ data: state.configsBySymbol }),
    deserialize: (raw: any) => ({ configsBySymbol: raw.data ?? {} }),
  }),

  setConfigsForSymbol: (symbol, configs) => {
    set((state) => ({
      configsBySymbol: { ...state.configsBySymbol, [symbol]: configs },
    }))
    get().markDirty()
  },

  addConfigForSymbol: (symbol, config) => {
    set((state) => ({
      configsBySymbol: {
        ...state.configsBySymbol,
        [symbol]: [...(state.configsBySymbol[symbol] ?? []), config],
      },
    }))
    get().markDirty()
  },

  updateConfigForSymbol: (symbol, id, updates) => {
    set((state) => ({
      configsBySymbol: {
        ...state.configsBySymbol,
        [symbol]: (state.configsBySymbol[symbol] ?? []).map((c) =>
          c.id === id ? { ...c, ...updates } : c,
        ),
      },
    }))
    get().markDirty()
  },

  removeConfigForSymbol: (symbol, id) => {
    set((state) => ({
      configsBySymbol: {
        ...state.configsBySymbol,
        [symbol]: (state.configsBySymbol[symbol] ?? []).filter((c) => c.id !== id),
      },
    }))
    get().markDirty()
  },
}))
