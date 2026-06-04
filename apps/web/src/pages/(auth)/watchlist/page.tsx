import { useMemo, useState, useCallback } from 'react'
import { BarChart3 } from 'lucide-react'
import { KlineChart } from '@eous/chart'
import type {
  FetchKlinesFn,
  KlineDataPoint,
  IntervalOption,
  SymbolItem,
  GetSymbolsFn,
  GetIntervalsFn,
  GetProvidersFn,
} from '@eous/chart'
import type { DataSourceInstance, SymbolSearchResult } from '@eous/types'
import { api } from '../../../lib/api.js'

const PAGE_SIZE = 50

/* ── Page ──────────────────────────────────────────────── */

export default function WatchlistPage() {
  const [selectedSymbol, setSelectedSymbol] = useState<{
    symbol: string
    name?: string
  } | null>(null)

  // ── Fetch functions (stable references via useMemo) ────────────────────

  const getProviders = useMemo<GetProvidersFn>(() => {
    return async () => {
      const d = await api.listDataSourceInstances()
      return d.instances.map((inst: DataSourceInstance) => ({
        id: inst.id,
        name: inst.name,
      }))
    }
  }, [])

  const getIntervals = useMemo<GetIntervalsFn>(() => {
    return async (providerId: string) => {
      const d = await api.getDataSourceIntervals(providerId)
      return d.intervals as IntervalOption[]
    }
  }, [])

  const getSymbols = useMemo<GetSymbolsFn>(() => {
    return async ({ providerId, query, offset = 0, limit = PAGE_SIZE }) => {
      if (query) {
        const data = await api.searchDataSourceSymbols(providerId, { query: query.trim() })
        const results: SymbolSearchResult[] = 'symbols' in data ? data.symbols : data.results
        return {
          items: results.map((r) => ({
            symbol: r.symbol,
            name: r.name,
            exchange: r.exchange,
            type: r.type,
            providerId,
          })),
          total: results.length,
        }
      }
      const data = await api.getDefaultSymbols(providerId, { offset, limit })
      return {
        items: data.symbols.map((r) => ({
          symbol: r.symbol,
          name: r.name,
          exchange: r.exchange,
          type: r.type,
          providerId,
        })),
        total: data.total,
      }
    }
  }, [])

  const fetchKlines = useMemo<FetchKlinesFn>(() => {
    return async ({ symbol, interval, from, to, providerId }) => {
      if (!providerId) return []
      const body: Record<string, unknown> = { symbol, interval }
      if (from !== undefined) body.from = from
      if (to !== undefined) body.to = to
      const data = await api.getDataSourceKlines(
        providerId,
        body as { symbol: string; interval: string; from?: number; to?: number },
      )
      return data.klines as KlineDataPoint[]
    }
  }, [])

  // ── Symbol change handler ──────────────────────────────────────────────
  const handleSymbolChange = useCallback((symbol: string | null) => {
    if (symbol) {
      setSelectedSymbol({ symbol })
    } else {
      setSelectedSymbol(null)
    }
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────
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
          fetchKlines={fetchKlines}
          getSymbols={getSymbols}
          getIntervals={getIntervals}
          getProviders={getProviders}
          defaultInterval="1d"
          onSymbolChange={handleSymbolChange}
        />
      </div>
    </div>
  )
}
