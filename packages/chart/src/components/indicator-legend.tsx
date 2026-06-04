import { useEffect, useRef, useCallback } from 'react'
import type { IChartApi, ISeriesApi, MouseEventParams, Time } from 'lightweight-charts'
import type { IndicatorConfig } from '../types'
import { getIndicatorDefinition } from '../indicators/registry'

// ── Types ───────────────────────────────────────────────────────────────────

interface IndicatorLegendProps {
  /** Currently active indicator configurations */
  indicators: IndicatorConfig[]
  /** Chart engine reference (IChartApi) */
  chartRef: IChartApi | null
  /** Series references mapped by indicator ID */
  seriesMapRef: React.MutableRefObject<Map<string, ISeriesApi<'Line' | 'Histogram'>[]>>
  /** Callback when an indicator is double-clicked */
  onDoubleClickIndicator: (id: string) => void
}

// ── Component ───────────────────────────────────────────────────────────────

export function IndicatorLegend({
  indicators,
  chartRef,
  seriesMapRef,
  onDoubleClickIndicator,
}: IndicatorLegendProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const itemsRef = useRef<Map<string, HTMLDivElement>>(new Map())
  const lastValuesRef = useRef<Map<string, (number | string)[]>>(new Map())

  const updateLegendValues = useCallback(
    (param: MouseEventParams<Time> | null) => {
      const container = containerRef.current
      if (!container) return

      for (const indicator of indicators) {
        const itemEl = itemsRef.current.get(indicator.id)
        if (!itemEl) continue

        const valueEl = itemEl.querySelector('.indicator-values')
        if (!valueEl) continue

        const seriesRefs = seriesMapRef.current.get(indicator.id) ?? []
        if (seriesRefs.length === 0) {
          valueEl.textContent = ''
          continue
        }

        const def = getIndicatorDefinition(indicator.type)
        const seriesLabels = def?.seriesLabels

        let values: (number | string)[] = []

        if (param && param.point) {
          // Get values at crosshair position
          for (let i = 0; i < seriesRefs.length; i++) {
            const series = seriesRefs[i]
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = series.data() as any[]
            const timeAtPoint = param.time as number

            // Find the bar closest to the crosshair time
            let barValue: number | string = '-'
            for (let j = data.length - 1; j >= 0; j--) {
              if ((data[j].time as number) <= timeAtPoint) {
                // For line series, use value; for candlestick-like, use close
                barValue = data[j].value ?? data[j].close ?? '-'
                break
              }
            }
            values.push(barValue)
          }
          lastValuesRef.current.set(indicator.id, values)
        } else {
          // No crosshair, use last known values or last bar
          values = lastValuesRef.current.get(indicator.id) ?? []
          if (values.length === 0) {
            // Get last bar values
            for (const series of seriesRefs) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const data = series.data() as any[]
              if (data.length > 0) {
                const lastBar = data[data.length - 1]
                values.push(lastBar.value ?? lastBar.close ?? '-')
              } else {
                values.push('-')
              }
            }
            lastValuesRef.current.set(indicator.id, values)
          }
        }

        // Format and display values
        const formattedValues = values.map((v, i) => {
          if (v === '-') return '-'
          const num = typeof v === 'string' ? parseFloat(v) : v
          if (isNaN(num)) return '-'
          const label = seriesLabels?.[i]
          return label ? `${label}: ${num.toFixed(2)}` : num.toFixed(2)
        })

        valueEl.textContent = formattedValues.join('  ')
      }
    },
    [indicators, seriesMapRef],
  )

  useEffect(() => {
    if (!chartRef) return

    const handler = (param: MouseEventParams<Time> | undefined) => {
      updateLegendValues(param ?? null)
    }

    chartRef.subscribeCrosshairMove(handler)

    return () => {
      chartRef.unsubscribeCrosshairMove(handler)
    }
  }, [chartRef, updateLegendValues])

  // Update items ref when indicators change
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Clear old refs
    itemsRef.current.clear()

    // Add refs for current indicators
    const items = container.querySelectorAll('[data-indicator-id]')
    items.forEach((el) => {
      const id = el.getAttribute('data-indicator-id')
      if (id) {
        itemsRef.current.set(id, el as HTMLDivElement)
      }
    })
  }, [indicators])

  // Initial update when indicators first appear
  useEffect(() => {
    if (indicators.length > 0) {
      // Small delay to ensure series refs are ready
      const timer = setTimeout(() => {
        updateLegendValues(null)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [indicators.length, updateLegendValues])

  const handleDoubleClick = useCallback(
    (id: string) => {
      onDoubleClickIndicator(id)
    },
    [onDoubleClickIndicator],
  )

  return (
    <div
      ref={containerRef}
      className="absolute top-2 left-[52px] z-10 flex flex-col gap-0.5 pointer-events-auto"
    >
      {indicators.map((indicator) => (
        <div
          key={indicator.id}
          data-indicator-id={indicator.id}
          className="flex items-center gap-2 bg-background/60 backdrop-blur-sm hover:bg-muted/50 transition-colors cursor-pointer"
          style={{ padding: '2px 8px' }}
          onDoubleClick={() => handleDoubleClick(indicator.id)}
        >
          <span className="font-mono text-[11px] text-foreground shrink-0">{indicator.label}</span>
          <span className="font-mono text-[11px] text-muted-foreground indicator-values truncate"></span>
        </div>
      ))}
    </div>
  )
}
