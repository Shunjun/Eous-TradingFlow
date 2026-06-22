import { createContext, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { ChartStore, ChartFetchFns } from './chart-store'

// ── Context ────────────────────────────────────────────────────────────────

export const ChartStoreContext = createContext<ChartStore | null>(null)

ChartStoreContext.displayName = 'ChartStoreContext'

// ── Provider props ─────────────────────────────────────────────────────────

interface ChartStoreProviderProps {
  store: ChartStore
  fetchFns: ChartFetchFns
  defaultSymbol?: string
  defaultProviderId?: string
  onSymbolChange?: (symbol: string | null) => void
  onProviderChange?: (providerId: string) => void
  onIntervalChange?: (interval: string) => void
  children: ReactNode
}

// ── Provider component ─────────────────────────────────────────────────────

export function ChartStoreProvider({
  store,
  fetchFns,
  defaultSymbol,
  defaultProviderId,
  onSymbolChange,
  onProviderChange,
  onIntervalChange,
  children,
}: ChartStoreProviderProps) {
  const onSymbolChangeRef = useRef(onSymbolChange)
  onSymbolChangeRef.current = onSymbolChange

  const onProviderChangeRef = useRef(onProviderChange)
  onProviderChangeRef.current = onProviderChange

  const onIntervalChangeRef = useRef(onIntervalChange)
  onIntervalChangeRef.current = onIntervalChange

  // ── Inject fetch functions into store ───────────────────────────────────
  useEffect(() => {
    store.getState().fetchFnsRef.current = fetchFns
  }, [store, fetchFns])

  // ── Load providers on mount ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    store
      .getState()
      .fetchFnsRef.current?.getProviders()
      .then((providers) => {
        if (cancelled) return
        store.setState({ providers })
        const defaultExists = providers.some((provider) => provider.id === defaultProviderId)
        const nextProviderId = defaultExists ? defaultProviderId! : (providers[0]?.id ?? '')
        const nextProvider = providers.find((provider) => provider.id === nextProviderId)
        store.setState({
          activeProviderId: nextProviderId,
          symbol: defaultSymbol ?? nextProvider?.defaultSymbol ?? null,
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [store, defaultProviderId, defaultSymbol])

  // ── Load intervals + default symbols when active provider changes ──────
  useEffect(() => {
    const unsub = store.subscribe((state, prev) => {
      if (state.activeProviderId === prev.activeProviderId) return
      const providerId = state.activeProviderId
      const fns = store.getState().fetchFnsRef.current
      const provider = store.getState().providers.find((item) => item.id === providerId)
      if (!providerId || !fns) {
        store.setState({
          intervals: [],
          symbols: [],
          symbol: null,
          offset: 0,
          hasMore: true,
          isSearching: false,
        })
        return
      }

      if (provider?.defaultSymbol && state.symbol !== provider.defaultSymbol) {
        store.setState({ symbol: provider.defaultSymbol })
      }

      // Load support for the chart-configured intervals
      const requestedIntervals = store.getState().intervals.map((item) => item.value)
      if (requestedIntervals.length === 0) return
      fns
        .getIntervals(providerId, requestedIntervals)
        .then((intervals) => {
          if (store.getState().activeProviderId !== providerId) return
          const supportByValue = new Map(intervals.map((iv) => [iv.value, iv]))
          const nextIntervals = store.getState().intervals.map((item) => {
            const support = supportByValue.get(item.value)
            return {
              ...item,
              supported: support?.supported ?? false,
              mode: support?.mode,
              baseInterval: support?.baseInterval,
              reason: support?.reason,
            }
          })
          const unsupportedIntervals = nextIntervals
            .filter((item) => !item.supported)
            .map((item) => item.value)
          store.setState({ intervals: nextIntervals, unsupportedIntervals })

          // Reset to default interval if current is unsupported
          const currentInterval = store.getState().interval
          if (unsupportedIntervals.includes(currentInterval)) {
            const fallback = nextIntervals.find((item) => item.supported)?.value ?? currentInterval
            store.setState({ interval: fallback })
            onIntervalChangeRef.current?.(fallback)
          }
        })
        .catch(() => {
          store.setState({ intervals: [] })
        })

      // Load default symbols
      store.setState({
        symbols: [],
        symbolsLoading: true,
        offset: 0,
        hasMore: true,
        isSearching: false,
      })
      fns
        .getSymbols({ providerId, offset: 0, limit: 50 })
        .then(({ items, total }) => {
          if (store.getState().activeProviderId !== providerId) return
          store.setState({
            symbols: items,
            symbolsLoading: false,
            offset: items.length,
            hasMore: items.length < total,
          })
        })
        .catch(() => {
          store.setState({ symbolsLoading: false })
        })
    })
    return unsub
  }, [store])

  // ── Notify external onProviderChange ───────────────────────────────────
  useEffect(() => {
    const unsub = store.subscribe((state, prev) => {
      if (state.activeProviderId === prev.activeProviderId) return
      onProviderChangeRef.current?.(state.activeProviderId)
    })
    return unsub
  }, [store])

  // ── Notify external onSymbolChange ─────────────────────────────────────
  useEffect(() => {
    const unsub = store.subscribe((state, prev) => {
      if (state.symbol === prev.symbol) return
      onSymbolChangeRef.current?.(state.symbol)
    })
    return unsub
  }, [store])

  // ── Notify external onIntervalChange ───────────────────────────────────
  useEffect(() => {
    const unsub = store.subscribe((state, prev) => {
      if (state.interval === prev.interval) return
      onIntervalChangeRef.current?.(state.interval)
    })
    return unsub
  }, [store])

  return <ChartStoreContext.Provider value={store}>{children}</ChartStoreContext.Provider>
}
