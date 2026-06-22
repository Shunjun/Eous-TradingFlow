import { useEffect, useRef, useCallback, useMemo, useState } from 'react'
import type { ChartTheme, IndicatorConfig } from '../types'
import type { LineToolType } from 'lightweight-charts-line-tools-core'
import { EventBus } from '../core/event-bus'
import type { ChartDataStatus } from '../core/event-bus'
import { KLineData } from '../core/kline-data'
import type { FetchKlinesFn, KlineDataPoint } from '../core/kline-data'
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
  const [readyVersion, setReadyVersion] = useState(0)

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
    setReadyVersion((value) => value + 1)

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

  const clearKlines = useCallback(() => {
    klineDataRef.current?.clear()
  }, [])

  const loadEarlier = useCallback(
    (fetchFn: FetchKlinesFn, symbol: string, interval: string, oldestTimestamp: number) => {
      klineDataRef.current?.loadEarlier(fetchFn, symbol, interval, oldestTimestamp)
    },
    [],
  )

  const upsertLatestKline = useCallback((kline: KlineDataPoint) => {
    klineDataRef.current?.upsertLatest(kline)
  }, [])

  const getKlineData = useCallback(() => klineDataRef.current, [])

  const subscribeDataStatus = useCallback((handler: (status: ChartDataStatus) => void) => {
    return eventBusRef.current?.on('data:status', ({ status }) => handler(status)) ?? (() => {})
  }, [])

  const setActiveDrawingTool = useCallback((type: LineToolType | 'none') => {
    lineToolsEngineRef.current?.setActiveTool(type)
  }, [])

  const toggleDrawingTool = useCallback((type: LineToolType) => {
    lineToolsEngineRef.current?.toggleTool(type)
  }, [])

  const deleteSelectedDrawing = useCallback(() => {
    lineToolsEngineRef.current?.deleteSelected()
  }, [])

  const activateDrawingSet = useCallback((key: string, remotePayload: string | null) => {
    lineToolsEngineRef.current?.activateDrawingSet(key, remotePayload)
  }, [])

  const getDirtyDrawings = useCallback(() => {
    return lineToolsEngineRef.current?.getDirtyDrawings() ?? []
  }, [])

  const markDrawingsSaved = useCallback((keys: string[]) => {
    lineToolsEngineRef.current?.markDrawingsSaved(keys)
  }, [])

  const subscribeDrawingsDirtyChange = useCallback((handler: (dirtyCount: number) => void) => {
    return lineToolsEngineRef.current?.onDirtyChange(handler) ?? (() => {})
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
      readyVersion,
      addIndicator,
      removeIndicator,
      switchMode,
      moveUp,
      moveDown,
      updateIndicator,
      loadKlines,
      switchInterval,
      clearKlines,
      loadEarlier,
      upsertLatestKline,
      getKlineData,
      subscribeDataStatus,
      setActiveDrawingTool,
      toggleDrawingTool,
      deleteSelectedDrawing,
      activateDrawingSet,
      getDirtyDrawings,
      markDrawingsSaved,
      subscribeDrawingsDirtyChange,
      getActiveDrawingTool,
    }),
    [
      readyVersion,
      addIndicator,
      removeIndicator,
      switchMode,
      moveUp,
      moveDown,
      updateIndicator,
      loadKlines,
      switchInterval,
      clearKlines,
      loadEarlier,
      upsertLatestKline,
      getKlineData,
      subscribeDataStatus,
      setActiveDrawingTool,
      toggleDrawingTool,
      deleteSelectedDrawing,
      activateDrawingSet,
      getDirtyDrawings,
      markDrawingsSaved,
      subscribeDrawingsDirtyChange,
      getActiveDrawingTool,
    ],
  )
}
