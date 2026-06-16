import { useEffect, useState, useCallback, useRef, useMemo, useContext } from 'react'
import type { ISeriesApi } from 'lightweight-charts'
import { useIndicatorStore } from '@eous/stores'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@eous/ui'
import { BarChart3, Loader2 } from 'lucide-react'
import type { KlineChartProps, IndicatorConfig } from './types'
import type { FetchKlinesFn } from './core/kline-data'
import type { ChartDataStatus } from './core/event-bus'
import { createChartStore } from './stores/chart-store'
import { ChartStoreProvider, ChartStoreContext } from './stores/chart-provider'
import { useChartStore } from './hooks/use-chart-store'
import { useChart } from './hooks/use-chart'
import { useResolvedTheme } from './hooks/use-resolved-theme'
import { ChartToolbar } from './components/chart-toolbar'
import { DrawingStyleToolbar } from './components/drawing-style-toolbar'
import { IndicatorConfigPanel } from './components/indicator-config-panel'
import { IndicatorLegend } from './components/indicator-legend'
import { LineToolsSidebar } from './components/line-tools-sidebar'
import { ResizablePanelHeader } from './components/resizable-panel-header'
import { LINE_TOOL_DEFINITIONS } from './line-tools/registry'
import { getIndicatorDefinition } from './indicators/registry'
import type { LineToolType } from 'lightweight-charts-line-tools-core'
import type { DrawingStyle } from './core/line-tools-engine'

const EMPTY_CONFIGS: IndicatorConfig[] = []

// ── Component ───────────────────────────────────────────────────────────────

export function KlineChart({
  fetchKlines,
  getSymbols,
  getIntervals,
  getProviders,
  getDrawings,
  saveDrawings,
  getChartConfig,
  saveChartConfig,
  defaultSymbol,
  defaultProviderId,
  defaultInterval = '1d',
  onSymbolChange,
  onProviderChange,
  onIntervalChange,
}: KlineChartProps) {
  const initialDefaultsRef = useRef({ defaultSymbol, defaultProviderId, defaultInterval })
  const storeRef = useRef<ReturnType<typeof createChartStore> | null>(null)
  if (!storeRef.current) {
    storeRef.current = createChartStore(initialDefaultsRef.current.defaultInterval ?? '1d')
  }
  const store = storeRef.current

  const fetchFns = useMemo(
    () => ({ fetchKlines, getSymbols, getIntervals, getProviders }),
    [fetchKlines, getSymbols, getIntervals, getProviders],
  )

  return (
    <ChartStoreProvider
      store={store}
      fetchFns={fetchFns}
      defaultSymbol={initialDefaultsRef.current.defaultSymbol}
      defaultProviderId={initialDefaultsRef.current.defaultProviderId}
      onSymbolChange={onSymbolChange}
      onProviderChange={onProviderChange}
      onIntervalChange={onIntervalChange}
    >
      <KlineChartInner
        fetchKlines={fetchKlines}
        getDrawings={getDrawings}
        saveDrawings={saveDrawings}
        getChartConfig={getChartConfig}
        saveChartConfig={saveChartConfig}
      />
    </ChartStoreProvider>
  )
}

// ── Inner component (accesses store) ────────────────────────────────────────

function KlineChartInner({
  fetchKlines,
  getDrawings,
  saveDrawings,
  getChartConfig,
  saveChartConfig,
}: {
  fetchKlines: FetchKlinesFn
  getDrawings?: KlineChartProps['getDrawings']
  saveDrawings?: KlineChartProps['saveDrawings']
  getChartConfig?: KlineChartProps['getChartConfig']
  saveChartConfig?: KlineChartProps['saveChartConfig']
}) {
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
    clearKlines,
    loadEarlier,
    getKlineData,
    subscribeDataStatus,
    activateDrawingSet,
    getDirtyDrawings,
    markDrawingsSaved,
    subscribeDrawingsDirtyChange,
    deleteSelectedDrawing,
    readyVersion,
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
  const [dataStatus, setDataStatus] = useState<ChartDataStatus>('idle')
  const [dirtyDrawingCount, setDirtyDrawingCount] = useState(0)
  const [drawingsSaving, setDrawingsSaving] = useState(false)
  const [autoSaveDrawings, setAutoSaveDrawings] = useState(false)

  useEffect(() => subscribeDataStatus(setDataStatus), [subscribeDataStatus])
  useEffect(
    () => subscribeDrawingsDirtyChange(setDirtyDrawingCount),
    [readyVersion, subscribeDrawingsDirtyChange],
  )

  useEffect(() => {
    if (!getChartConfig) return
    let cancelled = false
    getChartConfig()
      .then((config) => {
        if (!cancelled) setAutoSaveDrawings(config.autoSaveDrawings)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [getChartConfig])

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
    if (!symbol || !activeProviderId) {
      lastFetchedRef.current = null
      clearKlines()
      return
    }

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
  }, [activeProviderId, symbol, interval, clearKlines, loadKlines, switchInterval])

  useEffect(() => {
    if (!activeProviderId || !symbol) return

    const currentProviderId = activeProviderId
    const currentSymbol = symbol
    const key = createDrawingKey(currentProviderId, currentSymbol)
    let cancelled = false

    async function loadDrawings() {
      const payload = getDrawings
        ? await getDrawings({ providerId: currentProviderId, symbol: currentSymbol })
        : null
      if (cancelled) return
      activateDrawingSet(key, payload)
    }

    loadDrawings().catch(() => {
      if (!cancelled) activateDrawingSet(key, null)
    })

    return () => {
      cancelled = true
    }
  }, [activeProviderId, symbol, getDrawings, activateDrawingSet, readyVersion])

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
  const [selectedDrawingStyle, setSelectedDrawingStyle] = useState<DrawingStyle | null>(null)

  useEffect(() => {
    const engine = engines.lineTools.current
    if (!engine) return
    return engine.onSelectionChange((hasSelection, style) => {
      setHasSelectedDrawing(hasSelection)
      setSelectedDrawingStyle(style)
    })
  }, [engines.lineTools, readyVersion])

  useEffect(() => {
    const engine = engines.lineTools.current
    if (!engine) return
    setActiveDrawingTool(engine.activeTool)
    return engine.onActiveToolChange(setActiveDrawingTool)
  }, [engines.lineTools, readyVersion])

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

  const handleSaveDrawings = useCallback(async () => {
    if (!saveDrawings) return
    const dirty = getDirtyDrawings()
    if (dirty.length === 0) return

    const groups = new Map<string, { key: string; symbol: string; payload: string }[]>()
    for (const drawing of dirty) {
      const parsed = parseDrawingKey(drawing.key)
      if (!parsed) continue
      const group = groups.get(parsed.providerId) ?? []
      group.push({ key: drawing.key, symbol: parsed.symbol, payload: drawing.payload })
      groups.set(parsed.providerId, group)
    }

    if (groups.size === 0) return

    setDrawingsSaving(true)
    try {
      const savedKeys: string[] = []
      for (const [providerId, drawings] of groups) {
        await saveDrawings({
          providerId,
          drawings: drawings.map(({ symbol, payload }) => ({ symbol, payload })),
        })
        savedKeys.push(...drawings.map((drawing) => drawing.key))
      }
      markDrawingsSaved(savedKeys)
    } finally {
      setDrawingsSaving(false)
    }
  }, [getDirtyDrawings, markDrawingsSaved, saveDrawings])

  useEffect(() => {
    if (!autoSaveDrawings || dirtyDrawingCount === 0 || !saveDrawings) return
    const timer = setTimeout(() => {
      handleSaveDrawings().catch(() => {})
    }, 5000)
    return () => clearTimeout(timer)
  }, [autoSaveDrawings, dirtyDrawingCount, handleSaveDrawings, saveDrawings])

  const handleAutoSaveChange = useCallback(
    async (enabled: boolean) => {
      setAutoSaveDrawings(enabled)
      if (saveChartConfig) {
        await saveChartConfig({ autoSaveDrawings: enabled })
      }
    },
    [saveChartConfig],
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
        lineToolsEngine?.setActiveTool('none')
      } else {
        lineToolsEngine?.setActiveTool(id as LineToolType)
      }
    },
    [lineToolsEngine],
  )

  const handleDrawingStyleChange = useCallback(
    (updates: Partial<DrawingStyle>) => {
      const nextStyle = lineToolsEngine?.applySelectedDrawingStyle(updates)
      if (nextStyle) setSelectedDrawingStyle(nextStyle)
    },
    [lineToolsEngine],
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
  const overlayStatus: Exclude<ChartDataStatus, 'ready'> | null = !symbol
    ? 'idle'
    : dataStatus === 'loading' || dataStatus === 'empty' || dataStatus === 'error'
      ? dataStatus
      : null

  return (
    <div
      ref={wrapperRef}
      className="flex h-full w-full min-h-0 flex-col overflow-hidden bg-background"
    >
      {/* Toolbar — always visible */}
      <ChartToolbar
        onAddIndicator={handleAddIndicator}
        containerRef={wrapperRef}
        drawingDirtyCount={dirtyDrawingCount}
        drawingsSaving={drawingsSaving}
        autoSaveDrawings={autoSaveDrawings}
        onSaveDrawings={saveDrawings ? handleSaveDrawings : undefined}
        onAutoSaveDrawingsChange={saveChartConfig ? handleAutoSaveChange : undefined}
      />

      {/* Chart area with sidebar */}
      <div className="relative flex-1 flex min-h-0">
        {/* Left sidebar: line tools */}
        <LineToolsSidebar
          activeTool={activeDrawingTool}
          tools={LINE_TOOL_DEFINITIONS}
          onSelectTool={handleSelectTool}
        />

        <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
          <ResizablePanel defaultSize={panelOpen ? 72 : 100} minSize={55} className="min-w-0">
            <div className="relative flex-1 min-h-0 h-full" data-chart-container>
              <div ref={containerRef} className="h-full w-full" />
              {overlayStatus && <ChartEmptyState status={overlayStatus} />}

              <DrawingStyleToolbar
                visible={hasSelectedDrawing}
                style={selectedDrawingStyle}
                onStyleChange={handleDrawingStyleChange}
                onDelete={deleteSelectedDrawing}
              />

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

function createDrawingKey(providerId: string, symbol: string): string {
  return `${providerId}\u001f${symbol}`
}

function parseDrawingKey(key: string): { providerId: string; symbol: string } | null {
  const index = key.indexOf('\u001f')
  if (index <= 0) return null
  return {
    providerId: key.slice(0, index),
    symbol: key.slice(index + 1),
  }
}

function ChartEmptyState({ status }: { status: Exclude<ChartDataStatus, 'ready'> }) {
  const content =
    status === 'loading'
      ? {
          title: 'Loading market data',
          description: 'Fetching candles for the selected symbol.',
          icon: <Loader2 className="h-5 w-5 animate-spin" />,
        }
      : status === 'error'
        ? {
            title: 'Unable to load candles',
            description: 'Check the data source connection or choose another symbol.',
            icon: <BarChart3 className="h-5 w-5" />,
          }
        : status === 'empty'
          ? {
              title: 'No candles available',
              description: 'This data source returned no K-line data for the selected symbol.',
              icon: <BarChart3 className="h-5 w-5" />,
            }
          : {
              title: 'Select a symbol',
              description: 'Choose a market from the toolbar to display K-line data.',
              icon: <BarChart3 className="h-5 w-5" />,
            }

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
      <div className="flex max-w-sm flex-col items-center gap-2 text-center font-mono">
        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background/80 text-muted-foreground shadow-sm backdrop-blur">
          {content.icon}
        </div>
        <div className="text-sm font-medium text-foreground">{content.title}</div>
        <div className="text-xs leading-5 text-muted-foreground">{content.description}</div>
      </div>
    </div>
  )
}
