import { useEffect, useState, useCallback, useRef } from 'react'
import { useIndicatorStore } from '@eous/stores'
import type { KlineChartProps, IndicatorConfig } from '../types'
import type { FetchKlinesFn } from '../core/kline-data'
import { useChart } from '../hooks/use-chart'
import { useResolvedTheme } from '../hooks/use-resolved-theme'
import { ChartToolbar } from './chart-toolbar'
import { IndicatorPanel } from './indicator-panel'
import { LineToolsSidebar } from './line-tools-sidebar'
import { LINE_TOOL_DEFINITIONS } from '../line-tools/registry'
import type { LineToolType } from 'lightweight-charts-line-tools-core'

const EMPTY_CONFIGS: IndicatorConfig[] = []

// ── Component ───────────────────────────────────────────────────────────────

export function KlineChart({
  symbol,
  interval = '1d',
  intervals = [],
  onIntervalChange,
  fetchKlines,
}: KlineChartProps) {
  const chartTheme = useResolvedTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const {
    engines,
    addIndicator, removeIndicator, switchMode, moveUp, moveDown,
    loadKlines, switchInterval, loadEarlier, getKlineData,
    toggleDrawingTool, deleteSelectedDrawing,
  } = useChart(containerRef, chartTheme)

  const lineToolsEngine = engines.lineTools.current

  // ── Infinite scroll ─────────────────────────────────────
  const fetchKlinesRef = useRef(fetchKlines)
  fetchKlinesRef.current = fetchKlines
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
          fetchKlinesRef.current!,
          symbolRef.current!,
          intervalRef.current,
          oldestBar.time,
        )

        // Cooldown to prevent rapid re-triggers
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Load data on symbol/interval change ───────────────────
  const lastFetchedRef = useRef<{ symbol: string; interval: string } | null>(null)

  useEffect(() => {
    if (!fetchKlines || !symbol) return

    const prev = lastFetchedRef.current
    const symbolChanged = prev?.symbol !== symbol
    const intervalChanged = prev?.interval !== interval
    lastFetchedRef.current = { symbol, interval }

    if (symbolChanged || !prev) {
      loadKlines(fetchKlines, symbol, interval)
    } else if (intervalChanged) {
      switchInterval(fetchKlines, symbol, interval)
    }
  }, [symbol, interval, fetchKlines, loadKlines, switchInterval])

  // ── Indicator configs (persisted per symbol via Zustand store) ──────
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
    return () => {
      // cleanup handled by useChart destroy
    }
  }, [symbol, addIndicator])

  // ── Drawing tools state ─────────────────────────────────
  const [activeDrawingTool, setActiveDrawingTool] = useState<LineToolType | 'none'>('none')
  const [hasSelectedDrawing, setHasSelectedDrawing] = useState(false)

  // Subscribe to selection changes from the engine
  useEffect(() => {
    if (!lineToolsEngine) return
    return lineToolsEngine.onSelectionChange(setHasSelectedDrawing)
  }, [lineToolsEngine])

  // ── Keyboard shortcuts ──────────────────────────────────
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

  // ── Handlers ────────────────────────────────────────────
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

  const handleToggleIndicator = useCallback(
    (id: string) => {
      const configs = symbol ? (useIndicatorStore.getState().configsBySymbol[symbol] ?? []) : []
      const config = configs.find((c) => c.id === id)
      if (!config) return
      if (config.enabled) {
        if (symbol)
          useIndicatorStore.getState().updateConfigForSymbol(symbol, id, { enabled: false })
        removeIndicator(id)
      } else {
        if (symbol)
          useIndicatorStore.getState().updateConfigForSymbol(symbol, id, { enabled: true })
        addIndicator({ ...config, enabled: true })
      }
    },
    [symbol, addIndicator, removeIndicator],
  )

  const handleSwitchMode = useCallback(
    (id: string, mode: 'overlay' | 'split') => {
      if (symbol) useIndicatorStore.getState().updateConfigForSymbol(symbol, id, { mode })
      switchMode(id, mode)
    },
    [symbol, switchMode],
  )

  const handleMoveUp = useCallback((id: string) => moveUp(id), [moveUp])
  const handleMoveDown = useCallback((id: string) => moveDown(id), [moveDown])

  const handleUpdateIndicatorConfig = useCallback(
    (id: string, updates: Partial<IndicatorConfig>) => {
      if (symbol) useIndicatorStore.getState().updateConfigForSymbol(symbol, id, updates)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(engines.indicator.current as any)?.updateConfig(id, updates)
    },
    [symbol, engines],
  )

  return (
    <div className="flex flex-col h-full w-full min-h-0">
      {/* Toolbar — always visible */}
      <ChartToolbar
        interval={interval}
        intervals={intervals}
        onIntervalChange={onIntervalChange ?? (() => {})}
        symbol={symbol}
      />

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

        {/* Chart container */}
        <div className="relative flex-1 min-h-0">
          <div ref={containerRef} className="h-full w-full" />
          {!symbol && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm font-mono pointer-events-none">
              Select a symbol
            </div>
          )}
        </div>

        {/* Right panel: indicators */}
        <IndicatorPanel
          indicators={indicatorConfigs}
          onAdd={handleAddIndicator}
          onRemove={handleRemoveIndicator}
          onToggle={handleToggleIndicator}
          onSwitchMode={handleSwitchMode}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          onUpdateConfig={handleUpdateIndicatorConfig}
        />
      </div>
    </div>
  )
}
