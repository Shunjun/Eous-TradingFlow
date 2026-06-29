import type { CanonicalKline, KlineReadMode } from './market-data.types.js'
import { getRedisValue, setRedisValue } from '../../lib/redis.js'

const WINDOW_TTL_SECONDS = 60

function cacheKey(params: {
  seriesId: string
  mode: KlineReadMode
  from: number
  to: number
  limit?: number
}): string {
  return [
    'market-data:kline-window',
    params.seriesId,
    params.mode,
    String(params.from),
    String(params.to),
    String(params.limit ?? ''),
  ].join(':')
}

export async function getCachedKlineWindow(params: {
  seriesId: string
  mode: KlineReadMode
  from: number
  to: number
  limit?: number
}): Promise<CanonicalKline[] | null> {
  const raw = await getRedisValue(cacheKey(params))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as CanonicalKline[]
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export async function setCachedKlineWindow(params: {
  seriesId: string
  mode: KlineReadMode
  from: number
  to: number
  limit?: number
  klines: CanonicalKline[]
}): Promise<void> {
  await setRedisValue(
    cacheKey(params),
    JSON.stringify(params.klines),
    params.mode === 'include-live' ? 10 : WINDOW_TTL_SECONDS,
  )
}
