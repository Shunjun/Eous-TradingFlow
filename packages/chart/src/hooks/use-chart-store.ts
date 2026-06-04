import { useContext } from 'react'
import { useStore } from 'zustand'
import { ChartStoreContext } from '../stores/chart-provider'
import type { ChartState } from '../stores/chart-store'

export function useChartStore(): ChartState
export function useChartStore<T>(selector: (state: ChartState) => T): T
export function useChartStore<T>(selector?: (state: ChartState) => T) {
  const store = useContext(ChartStoreContext)
  if (!store) {
    throw new Error('useChartStore must be used within a KlineChart')
  }
  if (selector) {
    return useStore(store, selector)
  }
  return useStore(store)
}
