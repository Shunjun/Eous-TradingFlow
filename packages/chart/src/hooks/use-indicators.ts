import { useRef, useCallback, useMemo } from 'react'
import type { Time } from 'lightweight-charts'
import type { IChartApi, ISeriesApi } from 'lightweight-charts'
import type { IndicatorConfig } from '../types'
import { IndicatorManager } from '../indicators/manager'

export function useIndicatorManager(
  chart: IChartApi | null,
  candleSeries: ISeriesApi<'Candlestick'> | null,
) {
  const managerRef = useRef<IndicatorManager | null>(null)

  // Initialize manager when chart is available
  if (chart && candleSeries && !managerRef.current) {
    managerRef.current = new IndicatorManager(chart, candleSeries)
  }

  const setCloses = useCallback(
    (closes: { time: Time; close: number }[]) => {
      managerRef.current?.setCloses(closes)
    },
    [],
  )

  const addIndicator = useCallback(
    (config: IndicatorConfig) => {
      managerRef.current?.addIndicator(config)
    },
    [],
  )

  const removeIndicator = useCallback(
    (id: string) => {
      managerRef.current?.removeIndicator(id)
    },
    [],
  )

  const switchMode = useCallback(
    (id: string, mode: 'overlay' | 'split') => {
      managerRef.current?.switchMode(id, mode)
    },
    [],
  )

  const moveUp = useCallback(
    (id: string) => {
      managerRef.current?.moveUp(id)
    },
    [],
  )

  const moveDown = useCallback(
    (id: string) => {
      managerRef.current?.moveDown(id)
    },
    [],
  )

  const recomputeAll = useCallback(() => {
    managerRef.current?.recomputeAll()
  }, [])

  const updateConfig = useCallback(
    (id: string, updates: Partial<IndicatorConfig>) => {
      managerRef.current?.updateConfig(id, updates)
    },
    [],
  )

  const destroy = useCallback(() => {
    managerRef.current?.destroy()
    managerRef.current = null
  }, [])

  return useMemo(
    () => ({
      setCloses,
      addIndicator,
      removeIndicator,
      switchMode,
      moveUp,
      moveDown,
      recomputeAll,
      updateConfig,
      destroy,
    }),
    [setCloses, addIndicator, removeIndicator, switchMode, moveUp, moveDown, recomputeAll, updateConfig, destroy],
  )
}
