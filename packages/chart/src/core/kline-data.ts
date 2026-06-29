import type { Time } from 'lightweight-charts'
import type { ChartTheme } from '../types'
import { getDefaultKlineBarCount, subtractIntervals } from '../utils/interval'
import type { EventBus } from './event-bus'

/* ── Types ─────────────────────────────────────────────── */

export interface KlineDataPoint {
  timestamp: number // ms
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export type FetchKlinesFn = (params: {
  symbol: string
  interval: string
  from?: number
  to?: number
  limit?: number
  /** Active data provider ID — passed by the chart to identify which provider to query */
  providerId?: string
}) => Promise<KlineDataPoint[]>

export type SubscribeKlineUpdatesFn = (params: {
  providerId: string
  symbol: string
  interval: string
  onData: (kline: KlineDataPoint) => void
}) => () => void

/* ── KLineData ─────────────────────────────────────────── */

export class KLineData {
  private klines: KlineDataPoint[] = []
  private _loading = false
  private _hasMore = true
  private fetchId = 0
  private eventBus: EventBus
  private theme: ChartTheme
  private pendingRealtimeKlines: KlineDataPoint[] = []

  // Prevent infinite scroll during/after interval switch
  private suspendScroll = false
  // Cooldown: don't trigger infinite scroll right after a fetch completes
  private lastLoadTime = 0

  constructor(eventBus: EventBus, theme: ChartTheme) {
    this.eventBus = eventBus
    this.theme = theme
  }

  get loading() {
    return this._loading
  }
  get hasMoreData() {
    return this._hasMore
  }

  /** Return close price series for indicator computation */
  getCloses(): { time: Time; close: number }[] {
    return this.klines.map((k) => ({
      time: Math.floor(k.timestamp / 1000) as Time,
      close: k.close,
    }))
  }

  updateTheme(theme: ChartTheme) {
    this.theme = theme
    this.eventBus.emit('theme:changed', { theme })
  }

  upsertLatest(kline: KlineDataPoint): void {
    if (this._loading) {
      this.pendingRealtimeKlines = this.upsertInto(this.pendingRealtimeKlines, kline)
    }

    this.klines = this.upsertInto(this.klines, kline)
    this.eventBus.emit('data:updated', { klines: this.klines, fit: false })
    this.eventBus.emit('data:status', { status: 'ready' })
  }

  private upsertInto(data: KlineDataPoint[], kline: KlineDataPoint): KlineDataPoint[] {
    const klines = data
    const last = klines.at(-1)
    if (!last || kline.timestamp > last.timestamp) {
      return [...klines, kline]
    } else if (kline.timestamp === last.timestamp) {
      return [...klines.slice(0, -1), kline]
    }
    const index = klines.findIndex((item) => item.timestamp === kline.timestamp)
    if (index === -1) return klines
    return [...klines.slice(0, index), kline, ...klines.slice(index + 1)]
  }

  clear(): void {
    this.klines = []
    this.pendingRealtimeKlines = []
    this._hasMore = true
    this._loading = false
    this.eventBus.emit('data:updated', { klines: [], fit: true })
    this.eventBus.emit('data:status', { status: 'idle' })
  }

  // ── Initial load (no data → fit) ───────────────────────
  async loadInitial(fetchFn: FetchKlinesFn, symbol: string, interval: string): Promise<void> {
    this.suspendScroll = true
    this.klines = []
    this.pendingRealtimeKlines = []
    this._hasMore = true
    this.eventBus.emit('data:updated', { klines: [], fit: true })
    await this.fetch(fetchFn, symbol, interval, { limit: getDefaultKlineBarCount(interval) }, true)
    this.suspendScroll = false
  }

  // ── Switch interval (fetch latest data → fit) ──────────
  async switchInterval(fetchFn: FetchKlinesFn, symbol: string, interval: string): Promise<void> {
    this.suspendScroll = true
    this.klines = []
    this.pendingRealtimeKlines = []
    this._hasMore = true
    this.eventBus.emit('data:updated', { klines: [], fit: true })
    await this.fetch(fetchFn, symbol, interval, { limit: getDefaultKlineBarCount(interval) }, true)
    this.suspendScroll = false
  }

  // ── Load earlier data (user scroll → no fit) ───────────
  async loadEarlier(
    fetchFn: FetchKlinesFn,
    symbol: string,
    interval: string,
    oldestTimestamp: number,
  ): Promise<void> {
    // Cooldown: don't trigger right after a fetch completes (fitContent shows left edge)
    const cooldownMs = 1000
    if (this.suspendScroll || this._loading || !this._hasMore) return
    if (Date.now() - this.lastLoadTime < cooldownMs) return

    const ms = oldestTimestamp * 1000
    const barCount = getDefaultKlineBarCount(interval)
    await this.fetch(
      fetchFn,
      symbol,
      interval,
      {
        from: Math.max(0, subtractIntervals(ms, interval, barCount)),
        to: ms - 1,
      },
      false,
    )
  }

  // ── Internal fetch ─────────────────────────────────────
  private async fetch(
    fetchFn: FetchKlinesFn,
    symbol: string,
    interval: string,
    opts: { from?: number; to?: number; limit?: number },
    fit: boolean,
  ): Promise<void> {
    const id = ++this.fetchId
    this._loading = true
    if (fit) this.eventBus.emit('data:status', { status: 'loading' })

    try {
      const data = await fetchFn({ symbol, interval, ...opts })
      if (id !== this.fetchId) return // stale

      if (fit) {
        // Replace
        this.klines = data
      } else {
        // Prepend, dedup
        this.klines = this.merge(this.klines, data)
      }

      if (this.pendingRealtimeKlines.length > 0) {
        for (const kline of this.pendingRealtimeKlines) {
          this.klines = this.upsertInto(this.klines, kline)
        }
        this.pendingRealtimeKlines = []
      }

      this._hasMore = data.length >= 100
      this.eventBus.emit('data:updated', { klines: this.klines, fit })
      if (fit) {
        this.eventBus.emit('data:status', { status: this.klines.length > 0 ? 'ready' : 'empty' })
      }
      this.lastLoadTime = Date.now()
    } catch {
      if (id !== this.fetchId) return
      if (fit) {
        this.klines = []
        this._hasMore = false
        this.eventBus.emit('data:updated', { klines: [], fit: true })
        this.eventBus.emit('data:status', { status: 'error' })
      }
    } finally {
      if (id === this.fetchId) this._loading = false
    }
  }

  // ── Merge & dedup ──────────────────────────────────────
  private merge(existing: KlineDataPoint[], newData: KlineDataPoint[]): KlineDataPoint[] {
    const seen = new Set(existing.map((k) => k.timestamp))
    const toAdd: KlineDataPoint[] = []
    for (const k of newData) {
      if (!seen.has(k.timestamp)) {
        seen.add(k.timestamp)
        toAdd.push(k)
      }
    }
    if (toAdd.length === 0) return existing
    return [...toAdd, ...existing]
  }

  destroy(): void {
    this.clear()
  }
}
