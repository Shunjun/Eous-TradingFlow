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
import { getCachedKlineWindow, setCachedKlineWindow } from './kline-cache.js'
import { claimProviderFetch, runSingleFlight } from './kline-fetch-coordinator.js'
import { planKlineFetchRanges } from './kline-gap-planner.js'
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

function normalizeWindow(params: {
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
    const window = normalizeWindow({
      interval,
      mode,
      from: request.from,
      to: request.to,
      limit: request.limit,
    })

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

    const cached = await getCachedKlineWindow({
      seriesId: series.id,
      mode,
      from: window.from,
      to: window.to,
      limit: window.limit,
    })
    if (cached) return stripKlineMetadata(cached)

    let existing = await klineStore.findKlineBars({
      seriesId: series.id,
      from: window.from,
      to: window.to,
      includeLive,
    })

    for (let round = 0; round < MAX_FETCH_ROUNDS; round += 1) {
      const ranges = planKlineFetchRanges({
        existing,
        from: window.from,
        to: window.to,
        interval,
        includeLive,
      })
      if (ranges.length === 0) break

      let fetchedAny = false
      let waitedForPeer = false
      for (const range of ranges) {
        const lockKey = makeFetchKey({
          seriesId: series.id,
          requestInterval,
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
            provider,
            config,
            symbol,
            interval,
            requestInterval,
            support,
            range,
            mode,
          })
          if (fetched.length === 0) return
          fetchedAny = true
          await klineStore.upsertKlineBars({
            seriesId: series.id,
            intervalMs,
            klines: fetched,
          })
        })
      }

      const refreshed = await klineStore.findKlineBars({
        seriesId: series.id,
        from: window.from,
        to: window.to,
        includeLive,
      })
      if (refreshed.length === existing.length && !fetchedAny && !waitedForPeer) break
      existing = refreshed
    }

    const result = request.limit ? existing.slice(-window.limit) : existing
    await setCachedKlineWindow({
      seriesId: series.id,
      mode,
      from: window.from,
      to: window.to,
      limit: window.limit,
      klines: result,
    })

    return stripKlineMetadata(result)
  }
}

export const marketDataService = new MarketDataService()
