import {
  intervalToMs,
  type Kline,
  type RealtimeKlineEvent,
  type RealtimeMode,
} from '@eous/data-sources'
import { normalizeProviderKlines } from './kline-normalizer.js'
import * as klineStore from './kline-store.repo.js'
import { getCachedLatestKlines, LATEST_WINDOW_LIMIT, setCachedLatestKlines } from './kline-cache.js'
import type { CanonicalKline } from './market-data.types.js'

interface RealtimeSeriesInput {
  dataSourceInstanceId: string
  providerKind: string
  identityKey?: string | null
  symbol: string
  interval: string
}

interface IngestKlineInput {
  series: RealtimeSeriesInput
  kline: Kline
  source: RealtimeMode
  timestamp?: number
}

interface LiveState {
  seriesId: string
  intervalMs: number | null
  kline: CanonicalKline
}

function klineSignature(kline: CanonicalKline): string {
  return JSON.stringify([
    kline.timestamp,
    kline.open,
    kline.high,
    kline.low,
    kline.close,
    kline.volume,
    kline.isFinal,
  ])
}

class RealtimeIngestService {
  private readonly liveBySeriesKey = new Map<string, LiveState>()
  private readonly signatureBySeriesKey = new Map<string, string>()

  async ingestKline(input: IngestKlineInput): Promise<RealtimeKlineEvent | null> {
    const normalized = normalizeProviderKlines({
      klines: [input.kline],
      interval: input.series.interval,
      mode: 'include-live',
      now: input.timestamp,
    })[0]
    if (!normalized) return null

    const series = await klineStore.getOrCreateKlineSeries(input.series)
    const seriesKey = series.id
    const intervalMs = intervalToMs(input.series.interval)
    const previous = this.liveBySeriesKey.get(seriesKey)
    const toPersist: CanonicalKline[] = []

    if (previous && normalized.timestamp > previous.kline.timestamp && !previous.kline.isFinal) {
      toPersist.push({ ...previous.kline, isFinal: true })
    }

    toPersist.push(normalized)
    await klineStore.upsertKlineBars({
      seriesId: series.id,
      intervalMs,
      klines: toPersist,
    })

    this.liveBySeriesKey.set(seriesKey, {
      seriesId: series.id,
      intervalMs,
      kline: normalized,
    })
    await this.updateLatestCache(series.id, input.series.interval, normalized)

    const signature = klineSignature(normalized)
    if (this.signatureBySeriesKey.get(seriesKey) === signature) return null
    this.signatureBySeriesKey.set(seriesKey, signature)

    return {
      type: 'kline',
      symbol: input.series.symbol,
      interval: input.series.interval,
      data: {
        timestamp: normalized.timestamp,
        open: normalized.open,
        high: normalized.high,
        low: normalized.low,
        close: normalized.close,
        volume: normalized.volume,
      },
      isFinal: normalized.isFinal,
      source: input.source,
      timestamp: input.timestamp ?? Date.now(),
    }
  }

  private async updateLatestCache(
    seriesId: string,
    interval: string,
    kline: CanonicalKline,
  ): Promise<void> {
    const cached = await getCachedLatestKlines({ seriesId, mode: 'include-live' })
    const bars = cached?.bars ?? []
    const byTimestamp = new Map<number, CanonicalKline>()
    for (const item of bars) byTimestamp.set(item.timestamp, item)
    byTimestamp.set(kline.timestamp, kline)

    await setCachedLatestKlines({
      seriesId,
      interval,
      mode: 'include-live',
      bars: [...byTimestamp.values()]
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-LATEST_WINDOW_LIMIT),
    })
  }
}

export const realtimeIngestService = new RealtimeIngestService()
