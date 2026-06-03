import type { Time } from 'lightweight-charts'
import type { ChartTheme } from '../types'
import { parseIntervalMs } from '../utils/interval'
import type { EventBus } from './event-bus'

/** Default number of bars to load per request */
const LOAD_BAR_COUNT = 365

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
}) => Promise<KlineDataPoint[]>

/* ── KLineData ─────────────────────────────────────────── */

export class KLineData {
  private klines: KlineDataPoint[] = []
  private _loading = false
  private _hasMore = true
  private fetchId = 0
  private eventBus: EventBus
  private theme: ChartTheme

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

  // ── Initial load (no data → fit) ───────────────────────
  async loadInitial(fetchFn: FetchKlinesFn, symbol: string, interval: string): Promise<void> {
    this.suspendScroll = true
    this.klines = []
    this._hasMore = true
    await this.fetch(fetchFn, symbol, interval, {}, true)
    this.suspendScroll = false
  }

  // ── Switch interval (fetch latest data → fit) ──────────
  async switchInterval(fetchFn: FetchKlinesFn, symbol: string, interval: string): Promise<void> {
    this.suspendScroll = true
    this.klines = []
    this._hasMore = true
    // Don't send from/to → server defaults to latest data
    await this.fetch(fetchFn, symbol, interval, {}, true)
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
    const intervalMs = parseIntervalMs(interval)
    await this.fetch(
      fetchFn,
      symbol,
      interval,
      {
        from: ms - LOAD_BAR_COUNT * intervalMs,
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
    opts: { from?: number; to?: number },
    fit: boolean,
  ): Promise<void> {
    const id = ++this.fetchId
    this._loading = true

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

      this._hasMore = data.length >= 100
      this.eventBus.emit('data:updated', { klines: this.klines, fit })
      this.lastLoadTime = Date.now()
    } catch {
      if (id !== this.fetchId) return
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
    this.klines = []
    this._hasMore = true
    this._loading = false
  }
}

export { LOAD_BAR_COUNT }
