import { useEffect, useRef, useCallback, useMemo } from 'react'
import type { ChartTheme, IndicatorConfig } from '../types'
import type { LineToolType } from 'lightweight-charts-line-tools-core'
import { EventBus } from '../core/event-bus'
import { KLineData } from '../core/kline-data'
import type { FetchKlinesFn } from '../core/kline-data'
import { ChartEngine } from '../core/chart-engine'
import { IndicatorEngine } from '../core/indicator-engine'
import { LineToolsEngine } from '../core/line-tools-engine'

export function useChart(containerRef: React.RefObject<HTMLDivElement | null>, theme: ChartTheme) {
  const eventBusRef = useRef<EventBus | null>(null)
  const klineDataRef = useRef<KLineData | null>(null)
  const chartEngineRef = useRef<ChartEngine | null>(null)
  const indicatorEngineRef = useRef<IndicatorEngine | null>(null)
  const lineToolsEngineRef = useRef<LineToolsEngine | null>(null)
  const themeRef = useRef(theme)

  themeRef.current = theme

  // Mount: create all engines once
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const eventBus = new EventBus()
    const klineData = new KLineData(eventBus, themeRef.current)
    const chartEngine = new ChartEngine(container, eventBus, klineData, themeRef.current)
    const indicatorEngine = new IndicatorEngine(
      eventBus,
      klineData,
      chartEngine.chart,
      chartEngine.candleSeries,
    )
    const lineToolsEngine = new LineToolsEngine(chartEngine.chart, chartEngine.candleSeries)

    eventBusRef.current = eventBus
    klineDataRef.current = klineData
    chartEngineRef.current = chartEngine
    indicatorEngineRef.current = indicatorEngine
    lineToolsEngineRef.current = lineToolsEngine

    const observer = new ResizeObserver(() => chartEngine.resize())
    observer.observe(container)

    return () => {
      observer.disconnect()
      lineToolsEngine.destroy()
      indicatorEngine.destroy()
      chartEngine.destroy()
      klineData.destroy()
      eventBus.destroy()
      eventBusRef.current = null
      klineDataRef.current = null
      chartEngineRef.current = null
      indicatorEngineRef.current = null
      lineToolsEngineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Theme updates
  useEffect(() => {
    klineDataRef.current?.updateTheme(theme)
  }, [theme])

  const addIndicator = useCallback((config: IndicatorConfig) => {
    indicatorEngineRef.current?.addIndicator(config)
  }, [])

  const removeIndicator = useCallback((id: string) => {
    indicatorEngineRef.current?.removeIndicator(id)
  }, [])

  const switchMode = useCallback((id: string, mode: 'overlay' | 'split') => {
    indicatorEngineRef.current?.switchMode(id, mode)
  }, [])

  const moveUp = useCallback((id: string) => {
    indicatorEngineRef.current?.moveUp(id)
  }, [])

  const moveDown = useCallback((id: string) => {
    indicatorEngineRef.current?.moveDown(id)
  }, [])

  const updateIndicator = useCallback((id: string, updates: Partial<IndicatorConfig>) => {
    indicatorEngineRef.current?.updateConfig(id, updates)
  }, [])

  const loadKlines = useCallback((fetchFn: FetchKlinesFn, symbol: string, interval: string) => {
    klineDataRef.current?.loadInitial(fetchFn, symbol, interval)
  }, [])

  const switchInterval = useCallback((fetchFn: FetchKlinesFn, symbol: string, interval: string) => {
    klineDataRef.current?.switchInterval(fetchFn, symbol, interval)
  }, [])

  const loadEarlier = useCallback(
    (fetchFn: FetchKlinesFn, symbol: string, interval: string, oldestTimestamp: number) => {
      klineDataRef.current?.loadEarlier(fetchFn, symbol, interval, oldestTimestamp)
    },
    [],
  )

  const getKlineData = useCallback(() => klineDataRef.current, [])

  const setActiveDrawingTool = useCallback((type: LineToolType | 'none') => {
    lineToolsEngineRef.current?.setActiveTool(type)
  }, [])

  const toggleDrawingTool = useCallback((type: LineToolType) => {
    lineToolsEngineRef.current?.toggleTool(type)
  }, [])

  const deleteSelectedDrawing = useCallback(() => {
    lineToolsEngineRef.current?.deleteSelected()
  }, [])

  const getActiveDrawingTool = useCallback((): LineToolType | 'none' => {
    return lineToolsEngineRef.current?.activeTool ?? 'none'
  }, [])

  return useMemo(
    () => ({
      engines: {
        chart: chartEngineRef,
        klineData: klineDataRef,
        indicator: indicatorEngineRef,
        lineTools: lineToolsEngineRef,
      },
      addIndicator,
      removeIndicator,
      switchMode,
      moveUp,
      moveDown,
      updateIndicator,
      loadKlines,
      switchInterval,
      loadEarlier,
      getKlineData,
      setActiveDrawingTool,
      toggleDrawingTool,
      deleteSelectedDrawing,
      getActiveDrawingTool,
    }),
    [
      addIndicator,
      removeIndicator,
      switchMode,
      moveUp,
      moveDown,
      updateIndicator,
      loadKlines,
      switchInterval,
      loadEarlier,
      getKlineData,
      setActiveDrawingTool,
      toggleDrawingTool,
      deleteSelectedDrawing,
      getActiveDrawingTool,
    ],
  )
}
