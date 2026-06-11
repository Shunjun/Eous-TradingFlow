import { useEffect, useState, useCallback, useRef, useMemo, useContext } from 'react'
import type { ISeriesApi } from 'lightweight-charts'
import { useIndicatorStore } from '@eous/stores'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@eous/ui'
import type { KlineChartProps, IndicatorConfig } from './types'
import type { FetchKlinesFn } from './core/kline-data'
import { createChartStore } from './stores/chart-store'
import { ChartStoreProvider, ChartStoreContext } from './stores/chart-provider'
import { useChartStore } from './hooks/use-chart-store'
import { useChart } from './hooks/use-chart'
import { useResolvedTheme } from './hooks/use-resolved-theme'
import { ChartToolbar } from './components/chart-toolbar'
import { IndicatorConfigPanel } from './components/indicator-config-panel'
import { IndicatorLegend } from './components/indicator-legend'
import { LineToolsSidebar } from './components/line-tools-sidebar'
import { ResizablePanelHeader } from './components/resizable-panel-header'
import { LINE_TOOL_DEFINITIONS } from './line-tools/registry'
import { getIndicatorDefinition } from './indicators/registry'
import type { LineToolType } from 'lightweight-charts-line-tools-core'

const EMPTY_CONFIGS: IndicatorConfig[] = []

// ── Component ───────────────────────────────────────────────────────────────

export function KlineChart({
  fetchKlines,
  getSymbols,
  getIntervals,
  getProviders,
  defaultSymbol,
  defaultProviderId,
  defaultInterval = '1d',
  onSymbolChange,
  onProviderChange,
  onIntervalChange,
}: KlineChartProps) {
  const store = useMemo(() => createChartStore(defaultInterval), [defaultInterval])

  const fetchFns = useMemo(
    () => ({ fetchKlines, getSymbols, getIntervals, getProviders }),
    [fetchKlines, getSymbols, getIntervals, getProviders],
  )

  return (
    <ChartStoreProvider
      store={store}
      fetchFns={fetchFns}
      defaultSymbol={defaultSymbol}
      defaultProviderId={defaultProviderId}
      onSymbolChange={onSymbolChange}
      onProviderChange={onProviderChange}
      onIntervalChange={onIntervalChange}
    >
      <KlineChartInner fetchKlines={fetchKlines} />
    </ChartStoreProvider>
  )
}

// ── Inner component (accesses store) ────────────────────────────────────────

function KlineChartInner({ fetchKlines }: { fetchKlines: FetchKlinesFn }) {
  const chartTheme = useResolvedTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const store = useContext(ChartStoreContext)
  if (!store) throw new Error('KlineChartInner must be used within ChartStoreProvider')

  // Set chart container ref in store for Dialog portal
  const chartContainerRef = useChartStore((s) => s.chartContainerRef)
  useEffect(() => {
    chartContainerRef.current = wrapperRef.current
  }, [chartContainerRef])

  const {
    engines,
    addIndicator,
    removeIndicator,
    loadKlines,
    switchInterval,
    loadEarlier,
    getKlineData,
    toggleDrawingTool,
    deleteSelectedDrawing,
  } = useChart(containerRef, chartTheme)

  // ── ProviderId ref (synced from store subscription, not reactive) ────
  const providerIdRef = useRef(store.getState().activeProviderId)
  useEffect(() => {
    return store.subscribe((state) => {
      providerIdRef.current = state.activeProviderId
    })
  }, [store])

  // ── Wrapped fetchKlines that injects providerId ──────────────────────
  const fetchKlinesRef = useRef(fetchKlines)
  fetchKlinesRef.current = fetchKlines
  const wrappedFetchKlinesRef = useRef<FetchKlinesFn>((params) =>
    fetchKlinesRef.current({ ...params, providerId: providerIdRef.current }),
  )

  // ── Read state from store ─────────────────────────────────────────────
  const symbol = useChartStore((s) => s.symbol)
  const interval = useChartStore((s) => s.interval)
  const activeProviderId = useChartStore((s) => s.activeProviderId)
  const setIntervalAction = useChartStore((s) => s.setInterval)

  // ── Resizable panel state ─────────────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false)
  const [selectedIndicatorId, setSelectedIndicatorId] = useState<string | null>(null)

  // Series map for legend (indicator ID -> series refs)
  const seriesMapRef = useRef<Map<string, ISeriesApi<'Line' | 'Histogram'>[]>>(new Map())

  // Update series map when indicators change
  useEffect(() => {
    const indicatorEngine = engines.indicator.current
    if (!indicatorEngine) return

    const updateSeriesMap = () => {
      const instances = indicatorEngine.getInstances()
      const newMap = new Map<string, ISeriesApi<'Line' | 'Histogram'>[]>()
      for (const [id, instance] of instances) {
        newMap.set(id, instance.seriesRefs)
      }
      seriesMapRef.current = newMap
    }

    updateSeriesMap()
    return () => {}
  }, [engines.indicator])

  const lineToolsEngine = engines.lineTools.current

  // ── Infinite scroll ───────────────────────────────────────────────────
  const symbolRef = useRef(symbol)
  symbolRef.current = symbol
  const intervalRef = useRef(interval)
  intervalRef.current = interval

  useEffect(() => {
    const chart = engines.chart.current?.chart
    const candleSeries = engines.chart.current?.candleSeries
    if (!chart || !candleSeries) return
    const chartRef = chart
    const seriesRef = candleSeries

    let timer: ReturnType<typeof setTimeout> | null = null
    let cooldownTimer: ReturnType<typeof setTimeout> | null = null

    function handleVisibleRangeChange() {
      const klineData = getKlineData()
      if (!klineData || klineData.loading || !klineData.hasMoreData) return

      const range = chartRef.timeScale().getVisibleLogicalRange()
      if (!range || range.from > 1) return

      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        if (klineData.loading) return

        const data = seriesRef.data()
        if (!data || data.length === 0) return
        const oldestBar = data[0] as { time: number }

        loadEarlier(
          wrappedFetchKlinesRef.current,
          symbolRef.current!,
          intervalRef.current,
          oldestBar.time,
        )

        if (cooldownTimer) clearTimeout(cooldownTimer)
        cooldownTimer = setTimeout(() => {}, 1000)
      }, 300)
    }

    chartRef.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange)
    return () => {
      chartRef.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange)
      if (timer) clearTimeout(timer)
      if (cooldownTimer) clearTimeout(cooldownTimer)
    }
  }, [engines, getKlineData, loadEarlier])

  // ── Load data on symbol/interval change ───────────────────────────────
  const lastFetchedRef = useRef<{ providerId: string; symbol: string; interval: string } | null>(
    null,
  )

  useEffect(() => {
    if (!symbol || !activeProviderId) return

    const prev = lastFetchedRef.current
    const providerChanged = prev?.providerId !== activeProviderId
    const symbolChanged = prev?.symbol !== symbol
    const intervalChanged = prev?.interval !== interval
    lastFetchedRef.current = { providerId: activeProviderId, symbol, interval }

    const wrappedFetch = wrappedFetchKlinesRef.current
    if (providerChanged || symbolChanged || !prev) {
      loadKlines(wrappedFetch, symbol, interval)
    } else if (intervalChanged) {
      switchInterval(wrappedFetch, symbol, interval)
    }
  }, [activeProviderId, symbol, interval, loadKlines, switchInterval])

  // ── Indicator configs (persisted per symbol via Zustand store) ────────
  const indicatorConfigs = useIndicatorStore((s) =>
    symbol ? (s.configsBySymbol[symbol] ?? EMPTY_CONFIGS) : EMPTY_CONFIGS,
  )

  // Restore indicators when symbol changes
  useEffect(() => {
    if (!symbol) return
    const configs = useIndicatorStore.getState().configsBySymbol[symbol]
    if (!configs || configs.length === 0) return
    for (const config of configs) {
      if (config.enabled) addIndicator(config)
    }
    return () => {}
  }, [symbol, addIndicator])

  // ── Drawing tools state ───────────────────────────────────────────────
  const [activeDrawingTool, setActiveDrawingTool] = useState<LineToolType | 'none'>('none')
  const [hasSelectedDrawing, setHasSelectedDrawing] = useState(false)

  useEffect(() => {
    if (!lineToolsEngine) return
    return lineToolsEngine.onSelectionChange(setHasSelectedDrawing)
  }, [lineToolsEngine])

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setActiveDrawingTool('none')
        lineToolsEngine?.setActiveTool('none')
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && hasSelectedDrawing) {
        deleteSelectedDrawing()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hasSelectedDrawing, deleteSelectedDrawing, lineToolsEngine])

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleIntervalChange = useCallback(
    (iv: string) => {
      setIntervalAction(iv)
    },
    [setIntervalAction],
  )

  const handleDoubleClickIndicator = useCallback((id: string) => {
    setSelectedIndicatorId(id)
    setPanelOpen(true)
  }, [])

  const handleClosePanel = useCallback(() => {
    setPanelOpen(false)
    setSelectedIndicatorId(null)
  }, [])

  const handleSelectTool = useCallback(
    (id: string) => {
      if (id === 'none') {
        setActiveDrawingTool('none')
        lineToolsEngine?.setActiveTool('none')
      } else {
        const toolType = id as LineToolType
        setActiveDrawingTool(toolType)
        toggleDrawingTool(toolType)
      }
    },
    [lineToolsEngine, toggleDrawingTool],
  )

  const handleAddIndicator = useCallback(
    (config: IndicatorConfig) => {
      if (symbol) useIndicatorStore.getState().addConfigForSymbol(symbol, config)
      addIndicator(config)
    },
    [symbol, addIndicator],
  )

  const handleRemoveIndicator = useCallback(
    (id: string) => {
      if (symbol) useIndicatorStore.getState().removeConfigForSymbol(symbol, id)
      removeIndicator(id)
    },
    [symbol, removeIndicator],
  )

  const handleUpdateIndicatorConfig = useCallback(
    (id: string, updates: Partial<IndicatorConfig>) => {
      if (symbol) useIndicatorStore.getState().updateConfigForSymbol(symbol, id, updates)
      engines.indicator.current?.updateConfig(id, updates)
    },
    [symbol, engines],
  )

  const selectedIndicatorConfig = selectedIndicatorId
    ? (indicatorConfigs.find((c) => c.id === selectedIndicatorId) ?? null)
    : null

  const selectedIndicatorDefinition = selectedIndicatorConfig
    ? getIndicatorDefinition(selectedIndicatorConfig.type)
    : null

  const panelTitle =
    selectedIndicatorConfig && selectedIndicatorDefinition
      ? `${selectedIndicatorDefinition.label} Settings`
      : 'Settings'

  return (
    <div
      ref={wrapperRef}
      className="flex flex-col h-full w-full min-h-0 border border-border rounded-lg overflow-hidden"
    >
      {/* Toolbar — always visible */}
      <ChartToolbar onAddIndicator={handleAddIndicator} containerRef={wrapperRef} />

      {/* Chart area with sidebar */}
      <div className="relative flex-1 flex min-h-0">
        {/* Left sidebar: line tools */}
        <LineToolsSidebar
          activeTool={activeDrawingTool}
          tools={LINE_TOOL_DEFINITIONS}
          onSelectTool={handleSelectTool}
          onDeleteSelected={deleteSelectedDrawing}
          hasSelected={hasSelectedDrawing}
        />

        <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
          <ResizablePanel defaultSize={panelOpen ? 72 : 100} minSize={55} className="min-w-0">
            <div className="relative flex-1 min-h-0 h-full" data-chart-container>
              <div ref={containerRef} className="h-full w-full" />
              {!symbol && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-sm text-muted-foreground">
                  Select a symbol
                </div>
              )}

              {/* Indicator legend */}
              {engines.chart.current?.chart && (
                <IndicatorLegend
                  indicators={indicatorConfigs}
                  chartRef={engines.chart.current.chart}
                  seriesMapRef={seriesMapRef}
                  onDoubleClickIndicator={handleDoubleClickIndicator}
                />
              )}
            </div>
          </ResizablePanel>

          {panelOpen && (
            <>
              <ResizableHandle className="bg-transparent hover:bg-primary/50 active:bg-primary/60" />
              <ResizablePanel
                defaultSize={28}
                minSize={250}
                maxSize={380}
                className="min-w-[240px] border-l border-border bg-background"
              >
                <div className="flex h-full w-full flex-col overflow-hidden">
                  <ResizablePanelHeader title={panelTitle} onClose={handleClosePanel} />

                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <IndicatorConfigPanel
                      config={selectedIndicatorConfig}
                      definition={selectedIndicatorDefinition ?? null}
                      onUpdate={(updates) => {
                        if (!selectedIndicatorConfig) return
                        handleUpdateIndicatorConfig(selectedIndicatorConfig.id, updates)
                      }}
                      onRemove={() => {
                        if (!selectedIndicatorConfig) return
                        handleRemoveIndicator(selectedIndicatorConfig.id)
                        handleClosePanel()
                      }}
                    />
                  </div>
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
