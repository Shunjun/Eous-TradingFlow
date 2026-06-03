import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  CardPanel,
  CardPanelHeader,
  CardPanelBody,
  Button,
  Input,
  cn,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@eous/ui'
import { BarChart3, Search, Loader2, Plus, TrendingUp } from 'lucide-react'
import { KlineChart } from '@eous/chart'
import type { FetchKlinesFn, KlineDataPoint, IntervalOption } from '@eous/chart'
import type { DataSourceInstance, TrackedSymbol, SymbolSearchResult } from '@eous/types'
import { api } from '../../../lib/api.js'

/* ── Page ──────────────────────────────────────────────── */

export default function WatchlistPage() {
  // instances
  const [instances, setInstances] = useState<DataSourceInstance[]>([])
  const [selectedId, setSelectedId] = useState<string>('')

  // tracked symbols
  const [trackedSymbols, setTrackedSymbols] = useState<TrackedSymbol[]>([])

  // search
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SymbolSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  // selected symbol
  const [selectedSymbol, setSelectedSymbol] = useState<{
    symbol: string
    name?: string
  } | null>(null)

  // interval
  const [interval, setInterval] = useState('1d')
  const [intervals, setIntervals] = useState<IntervalOption[]>([])

  // adding symbol
  const [adding, setAdding] = useState<string | null>(null)

  // ── Data fetching function (provided to KlineChart) ──────
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

  // ── Load instances ─────────────────────────────────────

  useEffect(() => {
    api
      .listDataSourceInstances()
      .then((d: { instances: DataSourceInstance[] }) => {
        setInstances(d.instances)
        if (d.instances.length > 0 && !selectedId) {
          setSelectedId(d.instances[0].id)
        }
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load tracked symbols when instance changes ─────────

  const loadTracked = useCallback(async (id: string) => {
    if (!id) {
      setTrackedSymbols([])
      return
    }
    try {
      const data = await api.getDataSourceInstance(id)
      setTrackedSymbols(data.instance.trackedSymbols)
    } catch {
      setTrackedSymbols([])
    }
  }, [])

  useEffect(() => {
    if (selectedId) loadTracked(selectedId)
  }, [selectedId, loadTracked])

  // ── Load supported intervals when instance changes ─────
  useEffect(() => {
    if (!selectedId) {
      setIntervals([])
      return
    }
    api
      .getDataSourceIntervals(selectedId)
      .then((d: { intervals: IntervalOption[] }) => {
        setIntervals(d.intervals)
        // Reset interval if current one is not in the new list
        if (d.intervals.length > 0 && !d.intervals.some((i: IntervalOption) => i.value === interval)) {
          setInterval(d.intervals[d.intervals.length - 1].value)
        }
      })
      .catch(() => setIntervals([]))
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Search ─────────────────────────────────────────────

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId || !query.trim()) return
    setSearchError('')
    setSearching(true)
    setResults([])
    try {
      const data = await api.searchDataSourceSymbols(selectedId, { query: query.trim() })
      setResults('symbols' in data ? data.symbols : data.results)
    } catch (err: unknown) {
      setSearchError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  // ── Add symbol to tracked ──────────────────────────────

  async function handleAddSymbol(result: SymbolSearchResult) {
    if (!selectedId) return
    setAdding(result.symbol)
    try {
      await api.addDataSourceSymbol(selectedId, {
        symbol: result.symbol,
        name: result.name,
        exchange: result.exchange,
        type: result.type,
      })
      setResults((prev) => prev.filter((r) => r.symbol !== result.symbol))
      await loadTracked(selectedId)
    } catch (err: unknown) {
      setSearchError(err instanceof Error ? err.message : 'Failed to add')
    } finally {
      setAdding(null)
    }
  }

  // ── Select a symbol ────────────────────────────────────

  function selectSymbol(symbol: string, name?: string | null) {
    setSelectedSymbol({ symbol, name: name ?? undefined })
  }

  // ── Render ─────────────────────────────────────────────

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

      {/* Main grid: left sidebar + right chart */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* ── Left Panel ──────────────────────────────── */}
        <div className="w-72 shrink-0 flex flex-col gap-3 overflow-hidden">
          {/* Instance selector */}
          <CardPanel>
            <CardPanelBody className="p-3 space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Data Source
              </label>
              <Select
                value={selectedId || undefined}
                onValueChange={(v) => {
                  setSelectedId(v)
                  setSelectedSymbol(null)
                  setResults([])
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No instances configured" />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.name}
                      {inst.identityLabel ? ` (${inst.identityLabel})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardPanelBody>
          </CardPanel>

          {/* Search */}
          <CardPanel>
            <CardPanelBody className="p-3 space-y-2">
              <form onSubmit={handleSearch} className="flex gap-1.5">
                <div className="relative flex-1">
                  <Search
                    size={11}
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search symbol..."
                    className="font-mono text-xs h-8 pl-7"
                  />
                </div>
                <Button
                  type="submit"
                  variant="accent-outline"
                  size="sm"
                  disabled={searching || !query.trim() || !selectedId}
                  className="font-mono gap-1 h-8 text-[11px] shrink-0"
                >
                  {searching ? (
                    <Loader2 size={10} className="animate-spin" />
                  ) : (
                    <Search size={10} />
                  )}
                </Button>
              </form>
              {searchError && <p className="text-[10px] font-mono text-red-400">{searchError}</p>}
            </CardPanelBody>
          </CardPanel>

          {/* Tracked symbols + search results */}
          <CardPanel className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <CardPanelHeader icon={TrendingUp} title="Symbols" className="shrink-0" />
            <CardPanelBody className="flex-1 overflow-y-auto p-0">
              {trackedSymbols.length > 0 && (
                <div className="border-b border-border/50">
                  <div className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70 bg-muted/20">
                    Watching ({trackedSymbols.length})
                  </div>
                  {trackedSymbols.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => selectSymbol(s.symbol, s.name)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors',
                        'hover:bg-muted/30',
                        selectedSymbol?.symbol === s.symbol &&
                          'bg-primary/10 border-l-2 border-primary',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-xs font-medium truncate">{s.symbol}</div>
                        {s.name && (
                          <div className="font-mono text-[10px] text-muted-foreground truncate">
                            {s.name}
                          </div>
                        )}
                      </div>
                      {s.exchange && (
                        <span className="font-mono text-[9px] text-muted-foreground/50 shrink-0">
                          {s.exchange}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {results.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70 bg-muted/20">
                    Search Results
                  </div>
                  {results.map((r) => {
                    const alreadyTracked = trackedSymbols.some((t) => t.symbol === r.symbol)
                    return (
                      <div
                        key={r.symbol}
                        className="flex items-center gap-1 px-3 py-1.5 hover:bg-muted/30 group"
                      >
                        <button
                          onClick={() => selectSymbol(r.symbol, r.name)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <div className="font-mono text-xs font-medium truncate">{r.symbol}</div>
                          <div className="font-mono text-[10px] text-muted-foreground truncate">
                            {r.name}
                          </div>
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          {r.exchange && (
                            <span className="font-mono text-[9px] text-muted-foreground/50">
                              {r.exchange}
                            </span>
                          )}
                          {!alreadyTracked && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={adding === r.symbol}
                              onClick={() => handleAddSymbol(r)}
                              className="h-5 w-5 p-0 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              {adding === r.symbol ? (
                                <Loader2 size={9} className="animate-spin" />
                              ) : (
                                <Plus size={9} />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {trackedSymbols.length === 0 && results.length === 0 && (
                <div className="flex items-center justify-center py-8 text-muted-foreground font-mono text-[11px]">
                  {selectedId ? 'No symbols yet. Search to add.' : 'Select a data source.'}
                </div>
              )}
            </CardPanelBody>
          </CardPanel>
        </div>

        {/* ── Right Panel: Kline Chart (always mounted) ── */}
        <div className="flex-1 min-w-0">
          <CardPanel className="h-full flex flex-col">
            <CardPanelBody className="flex-1 min-h-0 p-0 relative">
              <KlineChart
                symbol={selectedSymbol?.symbol}
                interval={interval}
                intervals={intervals}
                onIntervalChange={setInterval}
                fetchKlines={fetchKlinesFn}
              />
            </CardPanelBody>
          </CardPanel>
        </div>
      </div>
    </div>
  )
}
