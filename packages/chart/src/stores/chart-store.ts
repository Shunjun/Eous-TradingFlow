import { createStore } from 'zustand/vanilla'
import type { RefObject } from 'react'
import type { IntervalOption, ProviderOption, SymbolItem } from '../types'
import type { FetchKlinesFn } from '../core/kline-data'

// ── Fetch function signatures ──────────────────────────────────────────────

export interface GetSymbolsParams {
  providerId: string
  query?: string
  offset?: number
  limit?: number
}

export interface GetSymbolsResult {
  items: SymbolItem[]
  total: number
}

export type GetSymbolsFn = (params: GetSymbolsParams) => Promise<GetSymbolsResult>
export type GetIntervalsFn = (providerId: string) => Promise<IntervalOption[]>
export type GetProvidersFn = () => Promise<ProviderOption[]>

// ── Fetch functions bundle ─────────────────────────────────────────────────

export interface ChartFetchFns {
  fetchKlines: FetchKlinesFn
  getSymbols: GetSymbolsFn
  getIntervals: GetIntervalsFn
  getProviders: GetProvidersFn
}

// ── Store state ────────────────────────────────────────────────────────────

export interface ChartState {
  // Provider
  providers: ProviderOption[]
  activeProviderId: string

  // Intervals
  intervals: IntervalOption[]
  unsupportedIntervals: string[]
  interval: string

  // Symbol
  symbol: string | null

  // Symbol list (default + search)
  symbols: SymbolItem[]
  symbolsLoading: boolean

  // Pagination
  offset: number
  hasMore: boolean
  loadingMore: boolean

  // Search
  isSearching: boolean

  // Non-reactive ref for Dialog portal
  chartContainerRef: RefObject<HTMLElement | null>

  // Mutable ref for fetch functions (set by provider, not reactive)
  fetchFnsRef: { current: ChartFetchFns | null }

  // Handlers (set by provider, not reactive)
  search: (query: string) => Promise<void>
  loadMore: () => Promise<void>

  // Actions
  setActiveProviderId: (id: string) => void
  setIntervals: (
    intervals: IntervalOption[] | ((prev: IntervalOption[]) => IntervalOption[]),
  ) => void
  setInterval: (interval: string) => void
  setSymbol: (symbol: string | null) => void
  setSymbols: (symbols: SymbolItem[] | ((prev: SymbolItem[]) => SymbolItem[])) => void
  setSymbolsLoading: (loading: boolean) => void
  setOffset: (offset: number | ((prev: number) => number)) => void
  setHasMore: (hasMore: boolean) => void
  setLoadingMore: (loading: boolean) => void
  setIsSearching: (searching: boolean) => void
}

// ── All known interval values (for computing unsupported intervals) ────────

const ALL_INTERVAL_VALUES = [
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '6h',
  '12h',
  '1d',
  '3d',
  '7d',
  '1w',
  '2w',
  '1M',
  '3M',
  '6M',
  '1y',
]

export { ALL_INTERVAL_VALUES }

// ── Store factory ──────────────────────────────────────────────────────────

export function createChartStore(interval: string) {
  const fetchFnsRef: { current: ChartFetchFns | null } = { current: null }
  let searchFetchId: object = {}

  return createStore<ChartState>()((set, get) => ({
    // Provider
    providers: [],
    activeProviderId: '',

    // Intervals
    intervals: [],
    unsupportedIntervals: [],
    interval,

    // Symbol
    symbol: null,

    // Symbol list
    symbols: [],
    symbolsLoading: false,

    // Pagination
    offset: 0,
    hasMore: true,
    loadingMore: false,

    // Search
    isSearching: false,

    // Non-reactive refs
    chartContainerRef: { current: null },
    fetchFnsRef,

    // ── Handlers ─────────────────────────────────────────────────────────

    search: async (query: string) => {
      const fns = fetchFnsRef.current
      const providerId = get().activeProviderId
      if (!fns || !providerId) return

      if (!query.trim()) {
        set({ isSearching: false, symbolsLoading: true })
        try {
          const { items, total } = await fns.getSymbols({ providerId, offset: 0, limit: 50 })
          if (get().activeProviderId !== providerId) return
          set({
            symbols: items,
            symbolsLoading: false,
            offset: items.length,
            hasMore: items.length < total,
            isSearching: false,
          })
        } catch {
          set({ symbolsLoading: false })
        }
        return
      }

      const fetchId = {}
      searchFetchId = fetchId
      set({ isSearching: true, symbolsLoading: true })
      try {
        const { items } = await fns.getSymbols({ providerId, query: query.trim() })
        if (searchFetchId !== fetchId) return
        if (get().activeProviderId !== providerId) return
        set({ symbols: items, symbolsLoading: false })
      } catch {
        if (searchFetchId !== fetchId) return
        set({ symbols: [], symbolsLoading: false })
      }
    },

    loadMore: async () => {
      const fns = fetchFnsRef.current
      const state = get()
      const providerId = state.activeProviderId
      if (!fns || !providerId || !state.hasMore || state.loadingMore) return

      set({ loadingMore: true })
      try {
        const { items, total } = await fns.getSymbols({
          providerId,
          offset: state.offset,
          limit: 50,
        })
        if (get().activeProviderId !== providerId) return
        const newOffset = state.offset + items.length
        set({
          symbols: [...state.symbols, ...items],
          offset: newOffset,
          hasMore: newOffset < total,
          loadingMore: false,
        })
      } catch {
        set({ loadingMore: false })
      }
    },

    // ── Actions ──────────────────────────────────────────────────────────

    setActiveProviderId: (id) => set({ activeProviderId: id }),
    setIntervals: (intervals) =>
      set((state) => ({
        intervals: typeof intervals === 'function' ? intervals(state.intervals) : intervals,
      })),
    setInterval: (interval) => set({ interval }),
    setSymbol: (symbol) => set({ symbol }),
    setSymbols: (symbols) =>
      set((state) => ({
        symbols: typeof symbols === 'function' ? symbols(state.symbols) : symbols,
      })),
    setSymbolsLoading: (loading) => set({ symbolsLoading: loading }),
    setOffset: (offset) =>
      set((state) => ({
        offset: typeof offset === 'function' ? offset(state.offset) : offset,
      })),
    setHasMore: (hasMore) => set({ hasMore }),
    setLoadingMore: (loading) => set({ loadingMore: loading }),
    setIsSearching: (searching) => set({ isSearching: searching }),
  }))
}

export type ChartStore = ReturnType<typeof createChartStore>
