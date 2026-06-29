import { prisma } from '@eous/db'
import type { CanonicalKline, KlineSeriesRef } from './market-data.types.js'

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  if (value && typeof value === 'object' && 'toString' in value) return Number(value.toString())
  return 0
}

export async function getOrCreateKlineSeries(params: {
  dataSourceInstanceId: string
  providerKind: string
  identityKey?: string | null
  symbol: string
  interval: string
}): Promise<KlineSeriesRef> {
  const series = await prisma.marketDataSeries.upsert({
    where: {
      dataSourceInstanceId_symbol_interval: {
        dataSourceInstanceId: params.dataSourceInstanceId,
        symbol: params.symbol,
        interval: params.interval,
      },
    },
    create: {
      dataSourceInstanceId: params.dataSourceInstanceId,
      providerKind: params.providerKind,
      identityKey: params.identityKey ?? null,
      symbol: params.symbol,
      interval: params.interval,
    },
    update: {
      providerKind: params.providerKind,
      identityKey: params.identityKey ?? null,
    },
  })

  return {
    id: series.id,
    dataSourceInstanceId: series.dataSourceInstanceId,
    providerKind: series.providerKind,
    identityKey: series.identityKey,
    symbol: series.symbol,
    interval: series.interval,
  }
}

export async function findKlineBars(params: {
  seriesId: string
  from: number
  to: number
  includeLive: boolean
  limit?: number
}): Promise<CanonicalKline[]> {
  const bars = await prisma.marketDataKlineBar.findMany({
    where: {
      seriesId: params.seriesId,
      openTime: {
        gte: new Date(params.from),
        lt: new Date(params.to),
      },
      ...(params.includeLive ? {} : { isFinal: true }),
    },
    orderBy: { openTime: 'asc' },
    ...(params.limit ? { take: Math.max(1, params.limit) } : {}),
  })

  return bars.map((bar) => ({
    timestamp: bar.openTime.getTime(),
    open: toNumber(bar.open),
    high: toNumber(bar.high),
    low: toNumber(bar.low),
    close: toNumber(bar.close),
    volume: bar.volume == null ? 0 : toNumber(bar.volume),
    isFinal: bar.isFinal,
  }))
}

export async function upsertKlineBars(params: {
  seriesId: string
  intervalMs: number | null
  klines: CanonicalKline[]
}): Promise<void> {
  if (params.klines.length === 0) return

  for (const kline of params.klines) {
    await prisma.marketDataKlineBar.upsert({
      where: {
        seriesId_openTime: {
          seriesId: params.seriesId,
          openTime: new Date(kline.timestamp),
        },
      },
      create: {
        seriesId: params.seriesId,
        openTime: new Date(kline.timestamp),
        closeTime: new Date(kline.timestamp + (params.intervalMs ?? 0)),
        open: kline.open,
        high: kline.high,
        low: kline.low,
        close: kline.close,
        volume: kline.volume,
        isFinal: kline.isFinal,
      },
      update: {
        closeTime: new Date(kline.timestamp + (params.intervalMs ?? 0)),
        open: kline.open,
        high: kline.high,
        low: kline.low,
        close: kline.close,
        volume: kline.volume,
        isFinal: kline.isFinal,
        fetchedAt: new Date(),
      },
    })
  }

  const finalBounds = await prisma.marketDataKlineBar.aggregate({
    where: { seriesId: params.seriesId, isFinal: true },
    _min: { openTime: true },
    _max: { openTime: true },
  })
  const latestLive = await prisma.marketDataKlineBar.findFirst({
    where: { seriesId: params.seriesId, isFinal: false },
    orderBy: { openTime: 'desc' },
  })

  await prisma.marketDataSyncState.upsert({
    where: { seriesId: params.seriesId },
    create: {
      seriesId: params.seriesId,
      earliestFinalOpenTime: finalBounds._min.openTime,
      latestFinalOpenTime: finalBounds._max.openTime,
      latestLiveOpenTime: latestLive?.openTime,
      lastFetchAt: new Date(),
      lastFetchError: null,
    },
    update: {
      earliestFinalOpenTime: finalBounds._min.openTime,
      latestFinalOpenTime: finalBounds._max.openTime,
      latestLiveOpenTime: latestLive?.openTime,
      lastFetchAt: new Date(),
      lastFetchError: null,
    },
  })
}
