import { intervalToMs, type Kline } from '@eous/data-sources'
import type { CanonicalKline, KlineReadMode } from './market-data.types.js'

const DEFAULT_FINALITY_DELAY_MS = 5_000

export function getEffectiveFinalTo(
  interval: string,
  mode: KlineReadMode,
  now = Date.now(),
): number {
  if (mode === 'include-live') return now
  const intervalMs = intervalToMs(interval)
  if (!intervalMs) return now - DEFAULT_FINALITY_DELAY_MS
  return Math.floor((now - DEFAULT_FINALITY_DELAY_MS) / intervalMs) * intervalMs
}

const CRYPTO_DAILY_BOUNDARY_OFFSET_MS = 8 * 60 * 60 * 1000

export function canonicalizeKlineTimestamp(timestamp: number, interval: string): number {
  const intervalMs = intervalToMs(interval)
  if (!intervalMs) return timestamp
  if (intervalMs >= 86_400_000) {
    return Math.floor((timestamp + CRYPTO_DAILY_BOUNDARY_OFFSET_MS) / intervalMs) * intervalMs
  }
  return Math.floor(timestamp / intervalMs) * intervalMs
}

export function normalizeProviderKlines(params: {
  klines: Kline[]
  interval: string
  mode: KlineReadMode
  now?: number
}): CanonicalKline[] {
  const intervalMs = intervalToMs(params.interval)
  const now = params.now ?? Date.now()

  return params.klines
    .filter((item) => Number.isFinite(item.timestamp))
    .map((item) => {
      const timestamp = canonicalizeKlineTimestamp(item.timestamp, params.interval)
      const closeTime = intervalMs ? timestamp + intervalMs : timestamp
      return {
        timestamp,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume ?? 0,
        isFinal: closeTime <= now - DEFAULT_FINALITY_DELAY_MS,
      }
    })
    .filter((item) => params.mode === 'include-live' || item.isFinal)
    .sort((a, b) => a.timestamp - b.timestamp)
}

export function stripKlineMetadata(klines: CanonicalKline[]): Kline[] {
  return klines.map(({ timestamp, open, high, low, close, volume }) => ({
    timestamp,
    open,
    high,
    low,
    close,
    volume,
  }))
}
