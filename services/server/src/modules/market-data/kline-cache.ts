import { intervalToMs } from '@eous/data-sources'
import { getRedisValue, setRedisValue } from '../../lib/redis.js'
import type { CanonicalKline, KlineReadMode } from './market-data.types.js'

const LATEST_TTL_SECONDS = 300
const SEGMENT_TTL_SECONDS = 3_600
export const LATEST_WINDOW_LIMIT = 1_000
export const SEGMENT_BAR_COUNT = 500

export interface CachedKlineWindow {
  seriesId: string
  interval: string
  mode: KlineReadMode
  firstTimestamp: number | null
  lastTimestamp: number | null
  updatedAt: number
  bars: CanonicalKline[]
}

export interface CachedKlineSegment {
  seriesId: string
  interval: string
  mode: KlineReadMode
  segmentStart: number
  segmentEnd: number
  complete: boolean
  updatedAt: number
  bars: CanonicalKline[]
}

function latestKey(seriesId: string, mode: KlineReadMode): string {
  return ['market-data:kline:latest', seriesId, mode].join(':')
}

function segmentKey(seriesId: string, mode: KlineReadMode, segmentStart: number): string {
  return ['market-data:kline:segment', seriesId, mode, String(segmentStart)].join(':')
}

export function getSegmentSpanMs(interval: string): number | null {
  const intervalMs = intervalToMs(interval)
  return intervalMs ? intervalMs * SEGMENT_BAR_COUNT : null
}

export function getSegmentStart(timestamp: number, interval: string): number | null {
  const span = getSegmentSpanMs(interval)
  if (!span) return null
  return Math.floor(timestamp / span) * span
}

export function getSegmentStarts(params: { interval: string; from: number; to: number }): number[] {
  const span = getSegmentSpanMs(params.interval)
  const first = getSegmentStart(params.from, params.interval)
  if (!span || first == null || params.to <= params.from) return []

  const starts: number[] = []
  for (let start = first; start < params.to; start += span) starts.push(start)
  return starts
}

function makeWindow(params: {
  seriesId: string
  interval: string
  mode: KlineReadMode
  bars: CanonicalKline[]
}): CachedKlineWindow {
  const bars = params.bars
  return {
    seriesId: params.seriesId,
    interval: params.interval,
    mode: params.mode,
    firstTimestamp: bars[0]?.timestamp ?? null,
    lastTimestamp: bars.at(-1)?.timestamp ?? null,
    updatedAt: Date.now(),
    bars,
  }
}

export async function getCachedLatestKlines(params: {
  seriesId: string
  mode: KlineReadMode
}): Promise<CachedKlineWindow | null> {
  const raw = await getRedisValue(latestKey(params.seriesId, params.mode))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as CachedKlineWindow
    return Array.isArray(parsed.bars) ? parsed : null
  } catch {
    return null
  }
}

export async function setCachedLatestKlines(params: {
  seriesId: string
  interval: string
  mode: KlineReadMode
  bars: CanonicalKline[]
}): Promise<void> {
  const bars = params.bars.slice(-LATEST_WINDOW_LIMIT)
  await setRedisValue(
    latestKey(params.seriesId, params.mode),
    JSON.stringify(makeWindow({ ...params, bars })),
    LATEST_TTL_SECONDS,
  )
}

export async function getCachedKlineSegment(params: {
  seriesId: string
  mode: KlineReadMode
  segmentStart: number
}): Promise<CachedKlineSegment | null> {
  const raw = await getRedisValue(segmentKey(params.seriesId, params.mode, params.segmentStart))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as CachedKlineSegment
    return Array.isArray(parsed.bars) ? parsed : null
  } catch {
    return null
  }
}

export async function setCachedKlineSegment(params: {
  seriesId: string
  interval: string
  mode: KlineReadMode
  segmentStart: number
  bars: CanonicalKline[]
  complete: boolean
}): Promise<void> {
  const span = getSegmentSpanMs(params.interval)
  if (!span) return

  const segment: CachedKlineSegment = {
    seriesId: params.seriesId,
    interval: params.interval,
    mode: params.mode,
    segmentStart: params.segmentStart,
    segmentEnd: params.segmentStart + span,
    complete: params.complete,
    updatedAt: Date.now(),
    bars: params.bars,
  }
  await setRedisValue(
    segmentKey(params.seriesId, params.mode, params.segmentStart),
    JSON.stringify(segment),
    SEGMENT_TTL_SECONDS,
  )
}
