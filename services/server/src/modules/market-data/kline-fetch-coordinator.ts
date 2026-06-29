import { setRedisOnce } from '../../lib/redis.js'

const inFlight = new Map<string, Promise<void>>()

export async function runSingleFlight(key: string, fn: () => Promise<void>): Promise<void> {
  const existing = inFlight.get(key)
  if (existing) return existing

  const promise = fn().finally(() => {
    inFlight.delete(key)
  })
  inFlight.set(key, promise)
  return promise
}

export async function claimProviderFetch(key: string, ttlSeconds = 60): Promise<boolean> {
  const claimed = await setRedisOnce(`market-data:fetch:${key}`, ttlSeconds)
  return claimed ?? true
}
