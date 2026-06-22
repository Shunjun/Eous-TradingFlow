'use client'

import { useSyncExternalStore } from 'react'
import {
  createIntervalSettingsStore,
  DEFAULT_INTERVAL_SETTINGS,
} from '../stores/interval-settings-store'
import type { IntervalSettings } from '../components/interval-selector/types'

const storeCache = new Map<string, ReturnType<typeof createIntervalSettingsStore>>()
const DEFAULT_KEY = 'eous:chart:interval-settings'

function getStore(storageKey: string) {
  if (!storeCache.has(storageKey)) {
    storeCache.set(storageKey, createIntervalSettingsStore(storageKey))
  }
  return storeCache.get(storageKey)!
}

export function useIntervalSettings(storageKey?: string) {
  const key = storageKey ?? DEFAULT_KEY
  const store = getStore(key)

  const settings = useSyncExternalStore(
    store.subscribe,
    () => store.getState(),
    () => DEFAULT_INTERVAL_SETTINGS,
  )

  return {
    settings: {
      visible: settings.visible,
      custom: settings.custom,
    } satisfies IntervalSettings,
    updateSettings: (next: IntervalSettings) => store.getState().updateSettings(next),
  }
}
