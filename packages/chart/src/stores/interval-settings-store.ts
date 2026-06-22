import { createStore } from 'zustand/vanilla'
import { persist } from 'zustand/middleware'
import type { IntervalSettings } from '../components/interval-selector/types'
import { DEFAULT_VISIBLE_INTERVAL_VALUES } from '../components/interval-selector/defaults'

export const DEFAULT_INTERVAL_SETTINGS: IntervalSettings = {
  visible: DEFAULT_VISIBLE_INTERVAL_VALUES,
  custom: [],
}

interface IntervalSettingsActions {
  updateSettings: (settings: IntervalSettings) => void
}

export type IntervalSettingsStore = IntervalSettings & IntervalSettingsActions

const DEFAULT_STORAGE_KEY = 'eous:chart:interval-settings'

function normalizeSettings(value: unknown): IntervalSettings {
  if (typeof value !== 'object' || value === null) return DEFAULT_INTERVAL_SETTINGS
  const candidate = value as Partial<IntervalSettings>
  return {
    visible: Array.isArray(candidate.visible)
      ? candidate.visible.filter((item): item is string => typeof item === 'string')
      : DEFAULT_VISIBLE_INTERVAL_VALUES,
    custom: Array.isArray(candidate.custom)
      ? candidate.custom
          .filter((item) => item && typeof item.value === 'string')
          .map((item) => ({
            value: item.value,
            label: typeof item.label === 'string' ? item.label : undefined,
          }))
      : [],
  }
}

export function createIntervalSettingsStore(storageKey?: string) {
  const key = storageKey ?? DEFAULT_STORAGE_KEY

  return createStore<IntervalSettingsStore>()(
    persist(
      (set) => ({
        ...DEFAULT_INTERVAL_SETTINGS,
        updateSettings: (settings) => set(normalizeSettings(settings)),
      }),
      {
        name: key,
        merge: (persisted, current) => ({
          ...current,
          ...normalizeSettings(persisted),
        }),
      },
    ),
  )
}

export type { IntervalSettingsActions }
