import { useState, useEffect, useCallback, useMemo } from 'react'
import { BarChart3 } from 'lucide-react'
import { KlineChart } from '@eous/chart'
import type { FetchKlinesFn, KlineDataPoint, IntervalOption, ProviderOption, SymbolItem } from '@eous/chart'
import type { DataSourceInstance, SymbolSearchResult } from '@eous/types'
import { api } from '../../../lib/api.js'

/** All known interval values — used to compute unsupported intervals per provider */
const ALL_INTERVAL_VALUES = [
  '1m', '3m', '5m', '15m', '30m',
  '1h', '2h', '4h', '6h', '12h',
  '1d', '3d', '7d', '1w', '2w',
  '1M', '3M', '6M', '1y',
]

/* ── Page ──────────────────────────────────────────────── */

export default function WatchlistPage() {
  // instances (data sources / providers)
  const [instances, setInstances] = useState<DataSourceInstance[]>([])
  const [selectedId, setSelectedId] = useState('')

  // intervals from the selected provider
  const [intervals, setIntervals] = useState<IntervalOption[]>([])

  // symbol search state
  const [searchResults, setSearchResults] = useState<SymbolItem[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  // selected symbol (for display in header)
  const [selectedSymbol, setSelectedSymbol] = useState<{
    symbol: string
    name?: string
  } | null>(null)

  // ── Provider options derived from instances ──────────────
  const providers: ProviderOption[] = useMemo(
    () => instances.map((inst) => ({ id: inst.id, name: inst.name })),
    [instances],
  )

  // ── Unsupported intervals (values in ALL_INTERVAL_VALUES but not in provider's intervals) ──
  const unsupportedIntervals = useMemo(() => {
    const supported = new Set(intervals.map((iv) => iv.value))
    return ALL_INTERVAL_VALUES.filter((v) => !supported.has(v))
  }, [intervals])

  // ── Load instances on mount ──────────────────────────────
  useEffect(() => {
    api
      .listDataSourceInstances()
      .then((d: { instances: DataSourceInstance[] }) => {
        setInstances(d.instances)
        if (d.instances.length > 0) {
          setSelectedId(d.instances[0].id)
        }
      })
      .catch(() => {})
  }, [])

  // ── Load intervals when instance changes ─────────────────
  useEffect(() => {
    if (!selectedId) {
      setIntervals([])
      return
    }
    api
      .getDataSourceIntervals(selectedId)
      .then((d: { intervals: IntervalOption[] }) => setIntervals(d.intervals))
      .catch(() => setIntervals([]))
  }, [selectedId])

  // ── Fetch klines function ───────────────────────────────
  const fetchKlinesFn = useMemo<FetchKlinesFn | undefined>(() => {
    if (!selectedId) return undefined
    const instanceId = selectedId
    return async ({ symbol, interval, from, to }) => {
      const body: Record<string, unknown> = { symbol, interval }
      if (from !== undefined) body.from = from
      if (to !== undefined) body.to = to
      const data = await api.getDataSourceKlines(
        instanceId,
        body as { symbol: string; interval: string; from?: number; to?: number },
      )
      return data.klines as KlineDataPoint[]
    }
  }, [selectedId])

  // ── Search symbols (called from SymbolSelector) ─────────
  const handleSearchChange = useCallback(
    async (query: string) => {
      if (!selectedId || !query.trim()) {
        setSearchResults([])
        return
      }
      setSearchLoading(true)
      try {
        const data = await api.searchDataSourceSymbols(selectedId, { query: query.trim() })
        const results: SymbolSearchResult[] = 'symbols' in data ? data.symbols : data.results
        setSearchResults(
          results.map((r) => ({
            symbol: r.symbol,
            name: r.name,
            exchange: r.exchange,
            type: r.type,
            providerId: selectedId,
          })),
        )
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    },
    [selectedId],
  )

  // ── Symbol select handler ───────────────────────────────
  const handleSymbolSelect = useCallback((item: SymbolItem) => {
    setSelectedSymbol({ symbol: item.symbol, name: item.name })
    setSelectedId(item.providerId)
    setSearchResults([])
  }, [])

  // ── Provider change handler ─────────────────────────────
  const handleProviderChange = useCallback((providerId: string) => {
    setSelectedId(providerId)
    setSelectedSymbol(null)
    setSearchResults([])
  }, [])

  // ── Render ──────────────────────────────────────────────
  return (
    <div className="p-6 max-w-[1600px] mx-auto h-[calc(100vh-4rem)] flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <BarChart3 size={18} className="text-primary" />
        <h1 className="font-mono text-sm font-semibold tracking-wide uppercase text-foreground">
          Watchlist
        </h1>
        {selectedSymbol && (
          <span className="font-mono text-xs text-muted-foreground">
            / {selectedSymbol.symbol}
            {selectedSymbol.name && (
              <span className="ml-1 text-muted-foreground/60">({selectedSymbol.name})</span>
            )}
          </span>
        )}
      </div>

      {/* Full-width chart */}
      <div className="flex-1 min-h-0">
        <KlineChart
          symbol={selectedSymbol?.symbol}
          interval="1d"
          intervals={intervals}
          fetchKlines={fetchKlinesFn}
          providers={providers}
          symbols={searchResults}
          activeProviderId={selectedId}
          onSymbolSelect={handleSymbolSelect}
          onSearchChange={handleSearchChange}
          onProviderChange={handleProviderChange}
          symbolsLoading={searchLoading}
          unsupportedIntervals={unsupportedIntervals}
        />
      </div>
    </div>
  )
}
