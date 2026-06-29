import {
  aggregateKlines,
  canonicalizeInterval,
  getDataSourceProvider,
  getDefaultKlineBarCount,
  intervalToMs,
  resolveIntervalSupport,
  subtractIntervals,
  type DataSourceProvider,
  type DataSourceSettings,
  type IntervalSupport,
  type Kline,
} from '@eous/data-sources'
import { AppError } from '../../lib/app-error.js'
import { decrypt, getEncryptionKey } from '../../lib/crypto-utils.js'
import * as dsRepo from '../../repositories/data-source.repo.js'
import {
  getCachedKlineSegment,
  getCachedLatestKlines,
  getSegmentSpanMs,
  getSegmentStarts,
  LATEST_WINDOW_LIMIT,
  setCachedKlineSegment,
  setCachedLatestKlines,
} from './kline-cache.js'
import { claimProviderFetch, runSingleFlight } from './kline-fetch-coordinator.js'
import {
  getEffectiveFinalTo,
  normalizeProviderKlines,
  stripKlineMetadata,
} from './kline-normalizer.js'
import * as klineStore from './kline-store.repo.js'
import type {
  CanonicalKline,
  GetKlinesRequest,
  KlineFetchRange,
  KlineReadMode,
} from './market-data.types.js'

const MIN_LIMIT = 1
const MAX_LIMIT = 5_000
const DEFAULT_PROVIDER_PAGE_BARS = 500
const MAX_FETCH_ROUNDS = 8
const FETCH_LOCK_TTL_SECONDS = 90

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function providerErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function clampLimit(value: number | undefined, interval: string): number {
  const fallback = getDefaultKlineBarCount(interval)
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(Math.max(Math.floor(value), MIN_LIMIT), MAX_LIMIT)
}

function decryptSettings(instance: {
  configEncrypted: string
  configIv: string
}): Record<string, string> {
  const keyHex = getEncryptionKey()
  return JSON.parse(decrypt(instance.configEncrypted, instance.configIv, keyHex)) as Record<
    string,
    string
  >
}

async function getProviderIntervalSupport(
  provider: DataSourceProvider<DataSourceSettings>,
  config: DataSourceSettings,
  intervals: string[],
): Promise<IntervalSupport[]> {
  if (provider.getIntervalSupport) {
    return provider.getIntervalSupport({ intervals }, config)
  }

  const nativeIntervals = provider.getSupportedIntervals
    ? (await provider.getSupportedIntervals(config)).map((item) => item.value)
    : []

  return resolveIntervalSupport({ requestedIntervals: intervals, nativeIntervals })
}

function normalizeRange(params: {
  interval: string
  mode: KlineReadMode
  from?: number
  to?: number
  limit?: number
}): { from: number; to: number; limit: number } {
  const limit = clampLimit(params.limit, params.interval)
  const effectiveTo = getEffectiveFinalTo(params.interval, params.mode)
  const to = Math.max(1, params.to ?? effectiveTo)
  const from = Math.max(0, params.from ?? subtractIntervals(to, params.interval, limit))
  return {
    from,
    to: Math.max(from + 1, to),
    limit,
  }
}

function getExpectedLatestOpen(interval: string, mode: KlineReadMode, now = Date.now()): number {
  const effectiveTo = getEffectiveFinalTo(interval, mode, now)
  const intervalMs = intervalToMs(interval)
  if (!intervalMs) return effectiveTo
  if (mode === 'include-live') {
    return Math.floor(effectiveTo / intervalMs) * intervalMs
  }
  return Math.max(0, effectiveTo - intervalMs)
}

function rangeForLatest(params: { interval: string; mode: KlineReadMode; limit: number }): {
  from: number
  to: number
} {
  const latestOpen = getExpectedLatestOpen(params.interval, params.mode)
  const intervalMs = intervalToMs(params.interval)
  const to = intervalMs ? latestOpen + intervalMs : Date.now()
  return {
    from: Math.max(0, subtractIntervals(to, params.interval, params.limit)),
    to,
  }
}

function rangeForBefore(params: { interval: string; before: number; limit: number }): {
  from: number
  to: number
} {
  const to = Math.max(1, params.before)
  return {
    from: Math.max(0, subtractIntervals(to, params.interval, params.limit)),
    to,
  }
}

function uniqSorted(klines: CanonicalKline[]): CanonicalKline[] {
  const byTimestamp = new Map<number, CanonicalKline>()
  for (const item of klines) byTimestamp.set(item.timestamp, item)
  return [...byTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp)
}

function filterRange(params: {
  klines: CanonicalKline[]
  from: number
  to: number
  includeLive: boolean
}): CanonicalKline[] {
  return params.klines.filter(
    (item) =>
      item.timestamp >= params.from &&
      item.timestamp < params.to &&
      (params.includeLive || item.isFinal),
  )
}

function findMissingRanges(params: {
  existing: CanonicalKline[]
  from: number
  to: number
  interval: string
}): KlineFetchRange[] {
  const intervalMs = intervalToMs(params.interval)
  if (!intervalMs || params.to <= params.from) return []

  const present = new Set(params.existing.map((item) => item.timestamp))
  const ranges: KlineFetchRange[] = []
  let rangeStart: number | null = null

  const start = Math.floor(params.from / intervalMs) * intervalMs
  for (let cursor = start; cursor < params.to; cursor += intervalMs) {
    if (cursor < params.from) continue
    if (present.has(cursor)) {
      if (rangeStart != null) {
        ranges.push({ from: rangeStart, to: cursor })
        rangeStart = null
      }
      continue
    }
    rangeStart ??= cursor
  }

  if (rangeStart != null) ranges.push({ from: rangeStart, to: params.to })
  return ranges
}

function makeFetchKey(params: {
  seriesId: string
  requestInterval: string
  from: number
  to: number
}): string {
  return [params.seriesId, params.requestInterval, params.from, params.to].join(':')
}

function getSegmentTo(range: KlineFetchRange, requestInterval: string): number {
  const intervalMs = intervalToMs(requestInterval)
  if (!intervalMs) return range.to
  return Math.min(range.to, range.from + intervalMs * DEFAULT_PROVIDER_PAGE_BARS)
}

function nextCursorFromKlines(klines: Kline[], fallback: number, requestInterval: string): number {
  if (klines.length === 0) return fallback
  const intervalMs = intervalToMs(requestInterval) ?? 1
  const latest = klines.reduce((max, item) => Math.max(max, item.timestamp), 0)
  return Math.max(fallback, latest + intervalMs)
}

async function fetchProviderRange(params: {
  provider: DataSourceProvider<DataSourceSettings>
  config: DataSourceSettings
  symbol: string
  interval: string
  requestInterval: string
  support: IntervalSupport
  range: KlineFetchRange
  mode: KlineReadMode
}): Promise<CanonicalKline[]> {
  const fetched: CanonicalKline[] = []
  let cursor = params.range.from
  let pages = 0

  while (cursor < params.range.to && pages < MAX_FETCH_ROUNDS) {
    pages += 1
    const segment = {
      from: cursor,
      to: getSegmentTo({ from: cursor, to: params.range.to }, params.requestInterval),
    }
    const sourceKlines = await params.provider.getKlines(
      {
        symbol: params.symbol,
        interval: params.requestInterval,
        from: segment.from,
        to: segment.to,
      },
      params.config,
    )
    const klines =
      params.support.mode === 'derived'
        ? aggregateKlines(sourceKlines, params.interval, params.support.aggregation)
        : sourceKlines

    fetched.push(
      ...normalizeProviderKlines({
        klines,
        interval: params.interval,
        mode: params.mode,
      }).filter((item) => item.timestamp >= params.range.from && item.timestamp < params.range.to),
    )

    const nextCursor = nextCursorFromKlines(sourceKlines, segment.to, params.requestInterval)
    if (nextCursor <= cursor) break
    cursor = Math.min(nextCursor, params.range.to)
  }

  const byTimestamp = new Map<number, CanonicalKline>()
  for (const item of fetched) byTimestamp.set(item.timestamp, item)
  return [...byTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp)
}

export class MarketDataService {
  async getKlines(request: GetKlinesRequest): Promise<Kline[]> {
    const { userId, dataSourceInstanceId, symbol } = request
    if (!symbol || !request.interval) {
      throw new AppError('Missing required fields: symbol, interval', 400)
    }

    const interval = canonicalizeInterval(request.interval)
    if (!interval) {
      throw new AppError(`Invalid interval: ${request.interval}`, 400)
    }

    const mode = request.mode ?? 'include-live'
    const limit = clampLimit(request.limit, interval)
    const query =
      request.query ??
      (request.before != null
        ? 'before'
        : request.from != null || request.to != null
          ? 'range'
          : 'latest')

    const instance = await dsRepo.findByIdAndUser(dataSourceInstanceId, userId)
    if (!instance) {
      throw new AppError('Instance not found', 404)
    }

    const provider = getDataSourceProvider(instance.providerKind)
    if (!provider) {
      throw new AppError(`Provider not found: ${instance.providerKind}`, 500)
    }

    const config = decryptSettings(instance)
    const support = (await getProviderIntervalSupport(provider, config, [interval]))[0]
    if (!support?.supported) {
      throw new AppError(
        `Unsupported interval for data source: ${support?.reason ?? interval}`,
        400,
      )
    }

    const requestInterval =
      support.mode === 'derived' ? (support.baseInterval ?? interval) : interval
    const intervalMs = intervalToMs(interval)
    const includeLive = mode === 'include-live'
    const series = await klineStore.getOrCreateKlineSeries({
      dataSourceInstanceId,
      providerKind: instance.providerKind,
      identityKey: instance.identityKey,
      symbol,
      interval,
    })

    if (query === 'latest') {
      const expectedLatestOpen = getExpectedLatestOpen(interval, mode)
      const cached = await getCachedLatestKlines({ seriesId: series.id, mode })
      if (
        cached?.interval === interval &&
        cached.bars.length >= limit &&
        (cached.lastTimestamp ?? -1) >= expectedLatestOpen
      ) {
        return stripKlineMetadata(cached.bars.slice(-limit))
      }
    }

    const range =
      query === 'latest'
        ? rangeForLatest({ interval, mode, limit: Math.max(limit, LATEST_WINDOW_LIMIT) })
        : query === 'before'
          ? rangeForBefore({ interval, before: request.before ?? Date.now(), limit })
          : normalizeRange({
              interval,
              mode,
              from: request.from,
              to: request.to,
              limit,
            })

    const existing = await this.loadRange({
      seriesId: series.id,
      symbol,
      mode,
      interval,
      requestInterval,
      support,
      provider,
      config,
      intervalMs,
      includeLive,
      from: range.from,
      to: range.to,
    })

    const result = query === 'range' && request.limit == null ? existing : existing.slice(-limit)
    if (query === 'latest') {
      await setCachedLatestKlines({
        seriesId: series.id,
        interval,
        mode,
        bars: existing.slice(-LATEST_WINDOW_LIMIT),
      })
    }
    return stripKlineMetadata(result)
  }

  private async loadRange(params: {
    seriesId: string
    symbol: string
    mode: KlineReadMode
    interval: string
    requestInterval: string
    support: IntervalSupport
    provider: DataSourceProvider<DataSourceSettings>
    config: DataSourceSettings
    intervalMs: number | null
    includeLive: boolean
    from: number
    to: number
  }): Promise<CanonicalKline[]> {
    const cached = await this.readSegments(params)
    if (cached) return cached

    let existing = await klineStore.findKlineBars({
      seriesId: params.seriesId,
      from: params.from,
      to: params.to,
      includeLive: params.includeLive,
    })

    for (let round = 0; round < MAX_FETCH_ROUNDS; round += 1) {
      const ranges = findMissingRanges({
        existing,
        from: params.from,
        to: params.to,
        interval: params.interval,
      })
      if (ranges.length === 0) break

      let fetchedAny = false
      let waitedForPeer = false
      for (const range of ranges) {
        const lockKey = makeFetchKey({
          seriesId: params.seriesId,
          requestInterval: params.requestInterval,
          from: range.from,
          to: range.to,
        })
        await runSingleFlight(lockKey, async () => {
          const claimed = await claimProviderFetch(lockKey, FETCH_LOCK_TTL_SECONDS)
          if (!claimed) {
            waitedForPeer = true
            await sleep(750)
            return
          }

          const fetched = await fetchProviderRange({
            provider: params.provider,
            config: params.config,
            symbol: params.symbol,
            interval: params.interval,
            requestInterval: params.requestInterval,
            support: params.support,
            range,
            mode: params.mode,
          })
          if (fetched.length === 0) return
          fetchedAny = true
          await klineStore.upsertKlineBars({
            seriesId: params.seriesId,
            intervalMs: params.intervalMs,
            klines: fetched,
          })
        })
      }

      const refreshed = await klineStore.findKlineBars({
        seriesId: params.seriesId,
        from: params.from,
        to: params.to,
        includeLive: params.includeLive,
      })
      if (refreshed.length === existing.length && !fetchedAny && !waitedForPeer) break
      existing = refreshed
    }

    const result = uniqSorted(
      filterRange({
        klines: existing,
        from: params.from,
        to: params.to,
        includeLive: params.includeLive,
      }),
    )
    await this.writeSegments({ ...params, klines: result })
    return result
  }

  private async readSegments(params: {
    seriesId: string
    mode: KlineReadMode
    interval: string
    includeLive: boolean
    from: number
    to: number
  }): Promise<CanonicalKline[] | null> {
    const span = getSegmentSpanMs(params.interval)
    if (!span) return null
    const starts = getSegmentStarts({ interval: params.interval, from: params.from, to: params.to })
    if (starts.length === 0) return null

    const segments = await Promise.all(
      starts.map((segmentStart) =>
        getCachedKlineSegment({ seriesId: params.seriesId, mode: params.mode, segmentStart }),
      ),
    )
    if (segments.some((segment) => !segment?.complete || segment.interval !== params.interval)) {
      return null
    }

    return uniqSorted(
      filterRange({
        klines: segments.flatMap((segment) => segment?.bars ?? []),
        from: params.from,
        to: params.to,
        includeLive: params.includeLive,
      }),
    )
  }

  private async writeSegments(params: {
    seriesId: string
    mode: KlineReadMode
    interval: string
    from: number
    to: number
    klines: CanonicalKline[]
  }): Promise<void> {
    const starts = getSegmentStarts({ interval: params.interval, from: params.from, to: params.to })
    const span = getSegmentSpanMs(params.interval)
    if (!span) return

    await Promise.all(
      starts.map((segmentStart) => {
        const segmentEnd = segmentStart + span
        const bars = params.klines.filter(
          (item) => item.timestamp >= segmentStart && item.timestamp < segmentEnd,
        )
        return setCachedKlineSegment({
          seriesId: params.seriesId,
          interval: params.interval,
          mode: params.mode,
          segmentStart,
          bars,
          complete: params.from <= segmentStart && params.to >= segmentEnd,
        })
      }),
    )
  }
}

export const marketDataService = new MarketDataService()
