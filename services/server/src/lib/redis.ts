import { createClient } from 'redis'

interface RedisClient {
  connect(): Promise<unknown>
  on(event: 'error', listener: (error: Error) => void): unknown
  set(key: string, value: string, options: { NX: true; EX: number }): Promise<string | null>
}

let clientPromise: Promise<RedisClient | null> | null = null
let warnedMissingUrl = false
let lastConnectFailureAt = 0
const REDIS_RETRY_AFTER_MS = 30_000

export async function getRedisClient(): Promise<RedisClient | null> {
  const url = process.env.REDIS_URL?.trim()
  if (!url) {
    if (!warnedMissingUrl) {
      console.warn('[redis] REDIS_URL is not set; Redis-backed coordination is disabled')
      warnedMissingUrl = true
    }
    return null
  }

  if (lastConnectFailureAt && Date.now() - lastConnectFailureAt < REDIS_RETRY_AFTER_MS) {
    return null
  }

  if (!clientPromise) {
    const client = createClient({ url }) as RedisClient
    client.on('error', (error) => {
      console.error('[redis] client error', error)
    })
    clientPromise = client
      .connect()
      .then(() => client)
      .catch((error) => {
        console.error('[redis] failed to connect', error)
        clientPromise = null
        lastConnectFailureAt = Date.now()
        return null
      })
  }

  return clientPromise
}

export async function setRedisOnce(key: string, ttlSeconds: number): Promise<boolean | null> {
  const client = await getRedisClient()
  if (!client) return null

  try {
    const result = await client.set(key, '1', {
      NX: true,
      EX: Math.max(1, ttlSeconds),
    })
    return result === 'OK'
  } catch (error) {
    console.error('[redis] set-once failed', error)
    return null
  }
}
