import { useEffect, useState, useCallback, useRef } from 'react'
import { useIndicatorStore } from '@eous/stores'
import type { KlineChartProps, IndicatorConfig } from '../types'
import type { FetchKlinesFn, KlineDataPoint } from '../kline-data'
import { KLineData } from '../kline-data'
import { useChartEngine } from '../hooks/use-chart-engine'
import { useIndicatorManager } from '../hooks/use-indicators'
import { useLineTools } from '../hooks/use-line-tools'
import { useResolvedTheme } from '../hooks/use-resolved-theme'
import { parseTime } from '../chart-engine'
import { ChartToolbar } from './chart-toolbar'
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
  const { engineRef } = useChartEngine(containerRef, chartTheme)

  const chart = engineRef.current?.chart ?? null
  const candleSeries = engineRef.current?.candleSeries ?? null

  const indicators = useIndicatorManager(chart, candleSeries)
  const lineTools = useLineTools(chart, candleSeries)

  // ── KLineData instance ─────────────────────────────────────
  const klineDataRef = useRef<KLineData | null>(null)

  // Create KLineData when engine is ready
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    klineDataRef.current = new KLineData(engine, chartTheme)
    return () => {
      klineDataRef.current = null
    }
    // Only create once when engine is ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineRef.current])

  // Keep theme in sync
  useEffect(() => {
    klineDataRef.current?.updateTheme(chartTheme)
  }, [chartTheme])

  // ── Infinite scroll ─────────────────────────────────────
  const fetchKlinesRef = useRef(fetchKlines)
  fetchKlinesRef.current = fetchKlines
  const symbolRef = useRef(symbol)
  symbolRef.current = symbol
  const intervalRef = useRef(interval)
  intervalRef.current = interval

  useEffect(() => {
    if (!chart || !candleSeries) return
    const chartRef = chart
    const seriesRef = candleSeries

    let timer: ReturnType<typeof setTimeout> | null = null
    let cooldownTimer: ReturnType<typeof setTimeout> | null = null

    function handleVisibleRangeChange() {
      const klineData = klineDataRef.current
      if (!klineData || klineData.loading || !klineData.hasMoreData) return

      const range = chartRef.timeScale().getVisibleLogicalRange()
      if (!range || range.from > 1) return

      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        if (klineData.loading) return

        const data = seriesRef.data()
        if (!data || data.length === 0) return
        const oldestBar = data[0] as { time: number }

        klineData.loadEarlier(
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
  }, [chart, candleSeries])

  // ── Load data on symbol/interval change ───────────────────
  const lastFetchedRef = useRef<{ symbol: string; interval: string } | null>(null)

  useEffect(() => {
    const klineData = klineDataRef.current
    if (!klineData || !fetchKlines || !symbol) return

    const prev = lastFetchedRef.current
    const symbolChanged = prev?.symbol !== symbol
    const intervalChanged = prev?.interval !== interval
    lastFetchedRef.current = { symbol, interval }

    if (symbolChanged || !prev) {
      // New symbol or first load → fetch latest data, fit
      klineData.loadInitial(fetchKlines, symbol, interval)
    } else if (intervalChanged) {
      // Interval changed → fetch latest data with new interval, fit
      klineData.switchInterval(fetchKlines, symbol, interval)
    }
  }, [symbol, interval, fetchKlines, engineRef])

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
      if (config.enabled) indicators.addIndicator(config)
    }
    return () => {
      indicators.destroy()
    }
  }, [symbol])

  // ── Drawing tools state ─────────────────────────────────
  const [activeDrawingTool, setActiveDrawingTool] = useState('none')
  const [hasSelectedDrawing, setHasSelectedDrawing] = useState(false)

  // ── Keyboard shortcuts ──────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setActiveDrawingTool('none')
      if ((e.key === 'Delete' || e.key === 'Backspace') && hasSelectedDrawing) {
        lineTools.deleteSelected()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hasSelectedDrawing, lineTools])

  // ── Handlers ────────────────────────────────────────────
  const handleDrawingToolChange = useCallback(
    (tool: string) => {
      setActiveDrawingTool(tool)
      if (tool !== 'none') lineTools.addLineTool(tool as LineToolType)
    },
    [lineTools],
  )

  const handleAddIndicator = useCallback(
    (config: IndicatorConfig) => {
      if (symbol) useIndicatorStore.getState().addConfigForSymbol(symbol, config)
      indicators.addIndicator(config)
    },
    [symbol, indicators],
  )

  const handleRemoveIndicator = useCallback(
    (id: string) => {
      if (symbol) useIndicatorStore.getState().removeConfigForSymbol(symbol, id)
      indicators.removeIndicator(id)
    },
    [symbol, indicators],
  )

  const handleToggleIndicator = useCallback(
    (id: string) => {
      const configs = symbol ? (useIndicatorStore.getState().configsBySymbol[symbol] ?? []) : []
      const config = configs.find((c) => c.id === id)
      if (!config) return
      if (config.enabled) {
        if (symbol)
          useIndicatorStore.getState().updateConfigForSymbol(symbol, id, { enabled: false })
        indicators.removeIndicator(id)
      } else {
        if (symbol)
          useIndicatorStore.getState().updateConfigForSymbol(symbol, id, { enabled: true })
        indicators.addIndicator({ ...config, enabled: true })
      }
    },
    [symbol, indicators],
  )

  const handleSwitchMode = useCallback(
    (id: string, mode: 'overlay' | 'split') => {
      if (symbol) useIndicatorStore.getState().updateConfigForSymbol(symbol, id, { mode })
      indicators.switchMode(id, mode)
    },
    [symbol, indicators],
  )

  const handleMoveUp = useCallback((id: string) => indicators.moveUp(id), [indicators])
  const handleMoveDown = useCallback((id: string) => indicators.moveDown(id), [indicators])

  return (
    <div className="flex flex-col h-full w-full min-h-0">
      {/* Toolbar — always visible */}
      <ChartToolbar
        interval={interval}
        intervals={intervals}
        onIntervalChange={onIntervalChange ?? (() => {})}
        symbol={symbol}
        indicators={indicatorConfigs}
        onAddIndicator={handleAddIndicator}
        onRemoveIndicator={handleRemoveIndicator}
        onToggleIndicator={handleToggleIndicator}
        onSwitchIndicatorMode={handleSwitchMode}
        onMoveIndicatorUp={handleMoveUp}
        onMoveIndicatorDown={handleMoveDown}
        activeDrawingTool={activeDrawingTool}
        onDrawingToolChange={handleDrawingToolChange}
        onDeleteSelected={() => lineTools.deleteSelected()}
        hasSelectedDrawing={hasSelectedDrawing}
      />

      {/* Chart area — always rendered */}
      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="h-full w-full" />
        {!symbol && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm font-mono pointer-events-none">
            Select a symbol
          </div>
        )}
      </div>
    </div>
  )
}
