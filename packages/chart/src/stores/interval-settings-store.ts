import { createStore } from 'zustand/vanilla'
import { persist } from 'zustand/middleware'
import type { IntervalItem, IntervalSettings } from '../components/interval-selector/types'

// ── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_VISIBLE: IntervalItem[] = [
  { label: '15m', value: '15m', visible: true, supported: true },
  { label: '1h', value: '1h', visible: true, supported: true },
  { label: '4h', value: '4h', visible: true, supported: true },
  { label: '1d', value: '1d', visible: true, supported: true },
  { label: '7d', value: '7d', visible: true, supported: true },
  { label: '1M', value: '1M', visible: true, supported: true },
  { label: '1y', value: '1y', visible: true, supported: true },
]

const DEFAULT_HIDDEN: IntervalItem[] = [
  { label: '1m', value: '1m', visible: false, supported: true },
  { label: '3m', value: '3m', visible: false, supported: true },
  { label: '5m', value: '5m', visible: false, supported: true },
  { label: '30m', value: '30m', visible: false, supported: true },
  { label: '2h', value: '2h', visible: false, supported: true },
  { label: '6h', value: '6h', visible: false, supported: true },
  { label: '12h', value: '12h', visible: false, supported: true },
  { label: '3d', value: '3d', visible: false, supported: true },
  { label: '1w', value: '1w', visible: false, supported: true },
  { label: '2w', value: '2w', visible: false, supported: true },
  { label: '3M', value: '3M', visible: false, supported: true },
  { label: '6M', value: '6M', visible: false, supported: true },
]

export const DEFAULT_INTERVAL_SETTINGS: IntervalSettings = {
  intervals: [...DEFAULT_VISIBLE, ...DEFAULT_HIDDEN],
}

// ── Merge logic ─────────────────────────────────────────────────────────────

function mergeWithDefaults(persisted: IntervalSettings): IntervalSettings {
  const persistedByValue = new Map(persisted.intervals.map((iv) => [iv.value, iv]))
  const seen = new Set<string>()
  const merged: IntervalItem[] = []

  for (const def of DEFAULT_INTERVAL_SETTINGS.intervals) {
    const existing = persistedByValue.get(def.value)
    if (existing) {
      merged.push({ ...def, visible: existing.visible })
    } else {
      merged.push({ ...def })
    }
    seen.add(def.value)
  }

  for (const iv of persisted.intervals) {
    if (!seen.has(iv.value)) {
      merged.push({ ...iv })
    }
  }

  return { intervals: merged }
}

// ── Type guard ──────────────────────────────────────────────────────────────

function isIntervalSettingsLike(value: unknown): value is IntervalSettings {
  if (typeof value !== 'object' || value === null) return false
  if (!('intervals' in value)) return false
  return Array.isArray(value.intervals) && value.intervals.length > 0
}

// ── Store ───────────────────────────────────────────────────────────────────

interface IntervalSettingsActions {
  updateIntervals: (intervals: IntervalItem[]) => void
}

export type IntervalSettingsStore = IntervalSettings & IntervalSettingsActions

const DEFAULT_STORAGE_KEY = 'eous:chart:interval-settings'

export function createIntervalSettingsStore(storageKey?: string) {
  const key = storageKey ?? DEFAULT_STORAGE_KEY

  return createStore<IntervalSettingsStore>()(
    persist(
      (set) => ({
        intervals: DEFAULT_INTERVAL_SETTINGS.intervals,

        updateIntervals: (intervals) => set({ intervals }),
      }),
      {
        name: key,
        merge: (persisted, current) => {
          if (!isIntervalSettingsLike(persisted)) {
            return current
          }
          const merged = mergeWithDefaults(persisted)
          return { ...current, ...merged }
        },
      },
    ),
  )
}

export type { IntervalSettingsActions }
