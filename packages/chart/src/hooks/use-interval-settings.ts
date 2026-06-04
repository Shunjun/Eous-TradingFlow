'use client'

import { useSyncExternalStore } from 'react'
import {
  createIntervalSettingsStore,
  DEFAULT_INTERVAL_SETTINGS,
} from '../stores/interval-settings-store'
import type { IntervalItem, IntervalSettings } from '../components/interval-selector/types'

// Module-level cache: one store per storage key
const storeCache = new Map<string, ReturnType<typeof createIntervalSettingsStore>>()

function getStore(storageKey: string) {
  if (!storeCache.has(storageKey)) {
    storeCache.set(storageKey, createIntervalSettingsStore(storageKey))
  }
  return storeCache.get(storageKey)!
}

const DEFAULT_KEY = 'eous:chart:interval-settings'

export function useIntervalSettings(storageKey?: string) {
  const key = storageKey ?? DEFAULT_KEY
  const store = getStore(key)

  const settings = useSyncExternalStore(
    store.subscribe,
    () => store.getState(),
    () => DEFAULT_INTERVAL_SETTINGS,
  )

  return {
    settings: { intervals: settings.intervals } satisfies IntervalSettings,
    updateIntervals: (intervals: IntervalItem[]) => store.getState().updateIntervals(intervals),
  }
}
