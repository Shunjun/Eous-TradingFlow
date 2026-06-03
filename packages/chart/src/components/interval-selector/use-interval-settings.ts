'use client'

import { useCallback, useEffect, useState } from 'react'
import type { IntervalItem, IntervalSettings } from './types'

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

// ── localStorage helpers ────────────────────────────────────────────────────

function defaultStorageKey(): string {
  return 'eous:chart:interval-settings'
}

function load(key: string): IntervalSettings {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return DEFAULT_INTERVAL_SETTINGS
    const parsed = JSON.parse(raw) as IntervalSettings
    // Basic validation: must have intervals array with items
    if (!Array.isArray(parsed.intervals) || parsed.intervals.length === 0) {
      return DEFAULT_INTERVAL_SETTINGS
    }
    // Merge with defaults to catch any new intervals added in future versions
    return mergeWithDefaults(parsed)
  } catch {
    return DEFAULT_INTERVAL_SETTINGS
  }
}

function save(key: string, settings: IntervalSettings): void {
  try {
    localStorage.setItem(key, JSON.stringify(settings))
  } catch {
    // localStorage quota exceeded or unavailable — silently degrade
  }
}

/**
 * Merge persisted settings with the default set so that any
 * new intervals added in a future release appear in the config.
 * The merge preserves:
 *   - Persisted visible flags and order for items that exist in defaults
 *   - Persisted order for hidden items
 *   - New default intervals are appended at the end (visible if default says so)
 */
function mergeWithDefaults(persisted: IntervalSettings): IntervalSettings {
  const persistedByValue = new Map(
    persisted.intervals.map((iv) => [iv.value, iv]),
  )
  const seen = new Set<string>()
  const merged: IntervalItem[] = []

  for (const def of DEFAULT_INTERVAL_SETTINGS.intervals) {
    const existing = persistedByValue.get(def.value)
    if (existing) {
      // Carry over the persisted visible flag and order, but keep the label from defaults
      merged.push({ ...def, visible: existing.visible })
    } else {
      // New interval from defaults — take default visibility
      merged.push({ ...def })
    }
    seen.add(def.value)
  }

  // Append any persisted intervals that are no longer in defaults
  // (e.g. custom intervals from a previous version)
  for (const iv of persisted.intervals) {
    if (!seen.has(iv.value)) {
      merged.push({ ...iv })
    }
  }

  return { intervals: merged }
}

// ── External store (subscribe-based, no zustand dep needed) ──────────────────

const stores = new Map<string, { listeners: Set<() => void> }>()

function getStore(key: string) {
  if (!stores.has(key)) {
    stores.set(key, { listeners: new Set() })
  }
  return stores.get(key)!
}

function emitChange(key: string) {
  getStore(key).listeners.forEach((fn) => fn())
}

function subscribe(key: string, listener: () => void) {
  const store = getStore(key)
  store.listeners.add(listener)
  return () => {
    store.listeners.delete(listener)
  }
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useIntervalSettings(storageKey?: string) {
  const key = storageKey ?? defaultStorageKey()

  const [settings, setSettings] = useState<IntervalSettings>(() => load(key))

  useEffect(() => {
    return subscribe(key, () => {
      const next = load(key)
      // Only update state if the data actually changed (by reference)
      setSettings((prev) => (prev === next ? prev : next))
    })
  }, [key])

  const updateIntervals = useCallback(
    (intervals: IntervalItem[]) => {
      save(key, { intervals })
      emitChange(key)
    },
    [key],
  )

  const toggleVisibility = useCallback(
    (value: string) => {
      const next = settings.intervals.map((iv) =>
        iv.value === value ? { ...iv, visible: !iv.visible } : iv,
      )
      updateIntervals(next)
    },
    [settings.intervals, updateIntervals],
  )

  const reorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      const list = [...settings.intervals]
      const [moved] = list.splice(fromIndex, 1)
      list.splice(toIndex, 0, moved)
      updateIntervals(list)
    },
    [settings.intervals, updateIntervals],
  )

  const moveAndToggle = useCallback(
    (fromIndex: number, toIndex: number, visible: boolean) => {
      const list = [...settings.intervals]
      const [moved] = list.splice(fromIndex, 1)
      list.splice(toIndex, 0, { ...moved, visible })
      updateIntervals(list)
    },
    [settings.intervals, updateIntervals],
  )

  return {
    settings,
    /** Replace the full intervals list (used by the editor on "完成") */
    updateIntervals,
    toggleVisibility,
    reorder,
    moveAndToggle,
  }
}
