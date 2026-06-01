import { useEffect, useRef, useCallback, useMemo } from 'react'
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  CrosshairMode,
  ColorType,
  LineStyle,
} from 'lightweight-charts'
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts'
import { cn } from '@eous/ui'

// ── Props ────────────────────────────────────────────────────────────────────

export interface KlineChartProps {
  data: {
    time: string // ISO 日期 "2024-01-15" 或 unix 时间戳
    open: number
    high: number
    low: number
    close: number
    volume?: number
  }[]
  symbol?: string
  interval?: string
  onIntervalChange?: (interval: string) => void
}

// ── Constants ────────────────────────────────────────────────────────────────

const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'] as const

const UP_COLOR = 'hsl(160, 84%, 39%)'
const DOWN_COLOR = 'hsl(0, 91%, 71%)'
const UP_COLOR_TRANSPARENT = 'hsla(160, 84%, 39%, 0.4)'
const DOWN_COLOR_TRANSPARENT = 'hsla(0, 91%, 71%, 0.4)'

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseTime(raw: string): Time {
  // 如果是纯数字字符串，当作 unix 秒时间戳
  if (/^\d+$/.test(raw)) {
    return Number(raw) as ReturnType<typeof Number> & Time
  }
  // 否则当作 ISO 日期字符串（business day string）
  return raw
}

function resolveCssVar(varName: string): string {
  if (typeof window === 'undefined') return ''
  const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  return val ? `hsl(${val})` : ''
}

// ── Component ────────────────────────────────────────────────────────────────

export function KlineChart({
  data,
  symbol,
  interval = '1d',
  onIntervalChange,
}: KlineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)

  // 预处理数据：拆分 K 线和成交量
  const { candleData, volumeData } = useMemo(() => {
    const candles: {
      time: Time
      open: number
      high: number
      low: number
      close: number
    }[] = []
    const volumes: {
      time: Time
      value: number
      color: string
    }[] = []

    for (const d of data) {
      const time = parseTime(d.time)
      candles.push({
        time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      })
      if (d.volume !== undefined) {
        volumes.push({
          time,
          value: d.volume,
          color: d.close >= d.open ? UP_COLOR_TRANSPARENT : DOWN_COLOR_TRANSPARENT,
        })
      }
    }
    return { candleData: candles, volumeData: volumes }
  }, [data])

  // 创建 chart + series
  const initChart = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    // 清理旧实例
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
    }

    const bg = resolveCssVar('--background')
    const fg = resolveCssVar('--muted-foreground')
    const border = resolveCssVar('--border')

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: bg },
        textColor: fg,
        fontSize: 11,
        fontFamily:
          'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
      },
      grid: {
        vertLines: { color: border },
        horzLines: { color: border },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: fg,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: fg,
        },
        horzLine: {
          color: fg,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: fg,
        },
      },
      rightPriceScale: {
        borderColor: border,
        scaleMargins: { top: 0.05, bottom: 0.25 },
      },
      timeScale: {
        borderColor: border,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    })

    // K 线 series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      borderUpColor: UP_COLOR,
      borderDownColor: DOWN_COLOR,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
    })
    candleSeries.setData(candleData)
    candleSeriesRef.current = candleSeries

    // 成交量 series（挂在底部 25%）
    if (volumeData.length > 0) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      })
      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      })
      volumeSeries.setData(volumeData)
      volumeSeriesRef.current = volumeSeries
    }

    chart.timeScale().fitContent()
    chartRef.current = chart
  }, [candleData, volumeData])

  // 初始化 + ResizeObserver
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    initChart()

    const observer = new ResizeObserver(() => {
      if (chartRef.current && container) {
        chartRef.current.resize(container.clientWidth, container.clientHeight)
      }
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
        candleSeriesRef.current = null
        volumeSeriesRef.current = null
      }
    }
  }, [initChart])

  // data 变化时更新 series（不重建 chart）
  useEffect(() => {
    if (!chartRef.current) return
    if (candleSeriesRef.current) {
      candleSeriesRef.current.setData(candleData)
    }
    if (volumeSeriesRef.current && volumeData.length > 0) {
      volumeSeriesRef.current.setData(volumeData)
    }
    chartRef.current.timeScale().fitContent()
  }, [candleData, volumeData])

  // ── Render ───────────────────────────────────────────────────────────────

  const isEmpty = data.length === 0

  return (
    <div className="flex flex-col h-full w-full min-h-0">
      {/* Header: symbol + interval 切换 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        {symbol && (
          <span className="font-mono text-xs text-muted-foreground tracking-wide">
            {symbol}
          </span>
        )}
        <div className="flex items-center gap-0.5">
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              onClick={() => onIntervalChange?.(iv)}
              className={cn(
                'px-2 py-0.5 text-[11px] font-mono rounded transition-colors',
                iv === interval
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              {iv}
            </button>
          ))}
        </div>
      </div>

      {/* Chart 容器 */}
      <div className="relative flex-1 min-h-0">
        {isEmpty ? (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm font-mono">
            No data
          </div>
        ) : (
          <div ref={containerRef} className="h-full w-full" />
        )}
      </div>
    </div>
  )
}
