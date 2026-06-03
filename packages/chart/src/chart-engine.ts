import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  CrosshairMode,
  ColorType,
  LineStyle,
} from 'lightweight-charts'
import type { IChartApi, ISeriesApi } from 'lightweight-charts'
import type { Time } from 'lightweight-charts'
import type { ChartTheme, ParsedBar, VolumeBar } from './types'

// ── Engine Interface ────────────────────────────────────────────────────────

export interface ChartEngine {
  chart: IChartApi
  candleSeries: ISeriesApi<'Candlestick'>
  volumeSeries: ISeriesApi<'Histogram'> | null
  container: HTMLElement

  /**
   * Update chart data.
   * @param fit - true: initial load/switch symbol/interval, call fitContent()
   *              false: user scrolled to load earlier data, keep viewport unchanged
   */
  setData(candles: ParsedBar[], volumes: VolumeBar[], fit: boolean): void
  applyTheme(theme: ChartTheme): void
  resize(): void
  destroy(): void

  /** Get visible time range in seconds. Returns null if chart has no data. */
  getVisibleRange(): { from: number; to: number } | null
}

// ── Factory ─────────────────────────────────────────────────────────────────

export function createChartEngine(
  container: HTMLElement,
  theme: ChartTheme,
): ChartEngine {
  const chart = createChart(container, {
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
    timeScale: {
      borderColor: theme.border,
      timeVisible: true,
      secondsVisible: false,
    },
    handleScroll: true,
    handleScale: true,
  })

  const candleSeries = chart.addSeries(CandlestickSeries, {
    upColor: theme.upColor,
    downColor: theme.downColor,
    borderUpColor: theme.upColor,
    borderDownColor: theme.downColor,
    wickUpColor: theme.upColor,
    wickDownColor: theme.downColor,
  })

  let volumeSeries: ISeriesApi<'Histogram'> | null = null

  function setData(candles: ParsedBar[], volumes: VolumeBar[], fit: boolean): void {
    candleSeries.setData(candles)
    if (volumes.length > 0 && volumeSeries) {
      volumeSeries.setData(volumes)
    }
    if (fit) {
      chart.timeScale().fitContent()
    }
  }

  function applyTheme(t: ChartTheme): void {
    chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: t.background },
        textColor: t.foreground,
      },
      grid: {
        vertLines: { color: t.border },
        horzLines: { color: t.border },
      },
      crosshair: {
        vertLine: { color: t.foreground, labelBackgroundColor: t.foreground },
        horzLine: { color: t.foreground, labelBackgroundColor: t.foreground },
      },
      rightPriceScale: { borderColor: t.border },
      timeScale: { borderColor: t.border },
    })
    candleSeries.applyOptions({
      upColor: t.upColor,
      downColor: t.downColor,
      borderUpColor: t.upColor,
      borderDownColor: t.downColor,
      wickUpColor: t.upColor,
      wickDownColor: t.downColor,
    })
  }

  function resize(): void {
    chart.resize(container.clientWidth, container.clientHeight)
  }

  function destroy(): void {
    chart.remove()
  }

  function getVisibleRange(): { from: number; to: number } | null {
    const range = chart.timeScale().getVisibleRange()
    if (!range) return null
    return { from: range.from as number, to: range.to as number }
  }

  return {
    chart,
    candleSeries,
    volumeSeries,
    container,
    setData,
    applyTheme,
    resize,
    destroy,
    getVisibleRange,
  }
}

// ── Data Helpers ────────────────────────────────────────────────────────────

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

// ── Volume Series Setup ─────────────────────────────────────────────────────

export function addVolumeSeries(engine: ChartEngine, volumes: VolumeBar[]): void {
  if (volumes.length === 0 || engine.volumeSeries) return

  const vs = engine.chart.addSeries(HistogramSeries, {
    priceFormat: { type: 'volume' },
    priceScaleId: 'volume',
  })
  engine.chart.priceScale('volume').applyOptions({
    scaleMargins: { top: 0.8, bottom: 0 },
  })
  vs.setData(volumes)
  engine.volumeSeries = vs
}
