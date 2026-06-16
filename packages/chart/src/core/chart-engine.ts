import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  CrosshairMode,
  ColorType,
  LineStyle,
} from 'lightweight-charts'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import type { IChartApi, ISeriesApi } from 'lightweight-charts'
import type { Time } from 'lightweight-charts'
import type { ChartTheme, ParsedBar, VolumeBar } from '../types'
import type { KlineDataPoint } from './kline-data'
import type { EventBus } from './event-bus'

const MIN_PRICE_PRECISION = 2
const MAX_PRICE_PRECISION = 8

dayjs.extend(utc)

// ── Data Helpers ────────────────────────────────────────────────────────────

function timeToDayjs(time: Time): dayjs.Dayjs | null {
  if (typeof time === 'number') {
    return dayjs.unix(time).utc()
  }
  if (typeof time === 'string' && /^\d+$/.test(time)) {
    return dayjs.unix(Number(time)).utc()
  }
  if (typeof time === 'object' && time && 'year' in time) {
    return dayjs.utc(`${time.year}-${time.month}-${time.day}`, 'YYYY-M-D')
  }
  return null
}

function formatChartTime(time: Time): string {
  return timeToDayjs(time)?.format('YYYY-MM-DD HH:mm') ?? String(time)
}

function formatTickTime(time: Time): string {
  const date = timeToDayjs(time)
  if (!date) return String(time)
  return date.hour() === 0 && date.minute() === 0
    ? date.format('MM-DD')
    : date.format('MM-DD HH:mm')
}

export function parseTime(raw: string): Time {
  if (/^\d+$/.test(raw)) {
    return Number(raw) as Time
  }
  return raw as unknown as Time
}

export function parseOhlcvData(
  data: { time: string; open: number; high: number; low: number; close: number; volume?: number }[],
  upColorTransparent: string,
  downColorTransparent: string,
): { candles: ParsedBar[]; volumes: VolumeBar[] } {
  const candles: ParsedBar[] = []
  const volumes: VolumeBar[] = []

  for (const d of data) {
    const time = parseTime(d.time)
    candles.push({ time, open: d.open, high: d.high, low: d.low, close: d.close })
    if (d.volume !== undefined) {
      volumes.push({
        time,
        value: d.volume,
        color: d.close >= d.open ? upColorTransparent : downColorTransparent,
      })
    }
  }
  return { candles, volumes }
}

function countDecimals(value: number): number {
  if (!Number.isFinite(value)) return MIN_PRICE_PRECISION

  const normalized = value.toFixed(12).replace(/0+$/, '').replace(/\.$/, '')
  const decimalIndex = normalized.indexOf('.')
  return decimalIndex === -1 ? 0 : normalized.length - decimalIndex - 1
}

function inferPricePrecision(klines: KlineDataPoint[]): number {
  let precision = MIN_PRICE_PRECISION
  const lastClose = klines.at(-1)?.close ?? 0
  const maxPrecision = getMaxPrecisionForPrice(lastClose)

  for (const kline of klines) {
    precision = Math.max(
      precision,
      countDecimals(kline.open),
      countDecimals(kline.high),
      countDecimals(kline.low),
      countDecimals(kline.close),
    )
    if (precision >= maxPrecision) return maxPrecision
  }

  return Math.min(maxPrecision, Math.max(MIN_PRICE_PRECISION, precision))
}

function getMaxPrecisionForPrice(price: number): number {
  const absPrice = Math.abs(price)
  if (absPrice >= 1000) return 2
  if (absPrice >= 1) return 4
  if (absPrice >= 0.01) return 6
  return MAX_PRICE_PRECISION
}

function precisionToMinMove(precision: number): number {
  return 1 / 10 ** precision
}

// ── ChartEngine ──────────────────────────────────────────────────────────────

export class ChartEngine {
  readonly chart: IChartApi
  readonly candleSeries: ISeriesApi<'Candlestick'>
  volumeSeries: ISeriesApi<'Histogram'> | null = null
  readonly container: HTMLElement

  private unsubData: () => void
  private unsubTheme: () => void
  private hasData = false

  constructor(container: HTMLElement, eventBus: EventBus, _klineData: unknown, theme: ChartTheme) {
    this.container = container

    this.chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: theme.background },
        textColor: theme.foreground,
        fontSize: 11,
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
      },
      grid: {
        vertLines: { color: theme.border },
        horzLines: { color: theme.border },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: theme.foreground,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: theme.foreground,
        },
        horzLine: {
          color: theme.foreground,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: theme.foreground,
        },
      },
      rightPriceScale: {
        borderColor: theme.border,
        scaleMargins: { top: 0.05, bottom: 0.25 },
      },
      localization: {
        locale: 'en-US',
        timeFormatter: formatChartTime,
      },
      timeScale: {
        borderColor: theme.border,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: formatTickTime,
      },
      handleScroll: true,
      handleScale: true,
    })

    this.candleSeries = this.chart.addSeries(CandlestickSeries, {
      upColor: theme.upColor,
      downColor: theme.downColor,
      borderUpColor: theme.upColor,
      borderDownColor: theme.downColor,
      wickUpColor: theme.upColor,
      wickDownColor: theme.downColor,
    })

    // Subscribe to events
    this.unsubData = eventBus.on('data:updated', ({ klines, fit }) => {
      this.setData(klines, fit)
    })
    this.unsubTheme = eventBus.on('theme:changed', ({ theme: t }) => {
      this.applyTheme(t)
    })
  }

  private setData(klines: KlineDataPoint[], fit: boolean): void {
    this.hasData = klines.length > 0
    this.setCrosshairVisible(this.hasData)

    if (klines.length > 0) {
      const precision = inferPricePrecision(klines)
      this.candleSeries.applyOptions({
        priceFormat: {
          type: 'price',
          precision,
          minMove: precisionToMinMove(precision),
        },
      })
    }

    const { candles, volumes } = parseOhlcvData(
      klines.map((k) => ({
        time: String(Math.floor(k.timestamp / 1000)),
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        volume: k.volume,
      })),
      'hsla(160, 84%, 39%, 0.4)',
      'hsla(0, 91%, 71%, 0.4)',
    )
    this.candleSeries.setData(candles)
    if (volumes.length > 0) {
      if (!this.volumeSeries) {
        this.volumeSeries = this.chart.addSeries(HistogramSeries, {
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
        })
        this.chart.priceScale('volume').applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
        })
      }
      this.volumeSeries.setData(volumes)
    } else {
      this.volumeSeries?.setData([])
    }
    if (fit) {
      this.chart.timeScale().fitContent()
    }
  }

  private applyTheme(t: ChartTheme): void {
    this.chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: t.background },
        textColor: t.foreground,
      },
      grid: {
        vertLines: { color: t.border },
        horzLines: { color: t.border },
      },
      crosshair: {
        vertLine: {
          color: t.foreground,
          labelBackgroundColor: t.foreground,
          visible: this.hasData,
          labelVisible: this.hasData,
        },
        horzLine: {
          color: t.foreground,
          labelBackgroundColor: t.foreground,
          visible: this.hasData,
          labelVisible: this.hasData,
        },
      },
      rightPriceScale: { borderColor: t.border },
      timeScale: { borderColor: t.border },
    })
    this.candleSeries.applyOptions({
      upColor: t.upColor,
      downColor: t.downColor,
      borderUpColor: t.upColor,
      borderDownColor: t.downColor,
      wickUpColor: t.upColor,
      wickDownColor: t.downColor,
    })
  }

  resize(): void {
    this.chart.resize(this.container.clientWidth, this.container.clientHeight)
  }

  private setCrosshairVisible(visible: boolean): void {
    this.chart.applyOptions({
      crosshair: {
        vertLine: { visible, labelVisible: visible },
        horzLine: { visible, labelVisible: visible },
      },
    })
  }

  getVisibleRange(): { from: number; to: number } | null {
    const range = this.chart.timeScale().getVisibleRange()
    if (!range) return null
    return { from: range.from as number, to: range.to as number }
  }

  destroy(): void {
    this.unsubData()
    this.unsubTheme()
    this.chart.remove()
  }
}
