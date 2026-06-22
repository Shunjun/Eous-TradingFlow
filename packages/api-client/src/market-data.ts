import { io, type Socket } from 'socket.io-client'

export interface KlineDataPoint {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export type RealtimeMode = 'stream' | 'poll'
export type RealtimeSubscribeMode = 'auto' | RealtimeMode

export interface MarketDataSubscribeParams {
  providerId: string
  symbol: string
  interval: string
  mode?: RealtimeSubscribeMode
  pollIntervalMs?: number
  onData: (kline: KlineDataPoint) => void
  onError?: (error: string) => void
}

type MarketDataSocketEvent =
  | {
      type: 'subscribed'
      requestId?: string
      subscriptionId: string
      source: RealtimeMode
    }
  | {
      type: 'unsubscribed'
      requestId?: string
      subscriptionId: string
    }
  | {
      type: 'kline'
      providerId: string
      subscriptionId: string
      symbol: string
      interval: string
      data: KlineDataPoint
      source: RealtimeMode
      timestamp: number
    }
  | {
      type: 'error'
      requestId?: string
      subscriptionId?: string
      error: string
    }

export interface MarketDataSocketClient {
  subscribeKlineUpdates(params: MarketDataSubscribeParams): () => void
  close(): void
}

export interface MarketDataSocketOptions {
  baseURL?: string
}

function resolveSocketBaseURL(baseURL: string): string {
  if (baseURL.startsWith('http://') || baseURL.startsWith('https://')) return baseURL
  if (typeof window === 'undefined') return baseURL
  return new URL(baseURL, window.location.href).origin
}

export function createMarketDataSocketClient(
  options: MarketDataSocketOptions = {},
): MarketDataSocketClient {
  const { baseURL = '/' } = options
  let socket: Socket | null = null
  let activeSubscriptions = 0

  const getSocket = () => {
    if (socket) return socket
    socket = io(`${resolveSocketBaseURL(baseURL)}/market-data`, {
      path: '/ws',
      withCredentials: true,
      transports: ['websocket', 'polling'],
    })
    return socket
  }

  const releaseSocket = () => {
    activeSubscriptions = Math.max(activeSubscriptions - 1, 0)
    if (activeSubscriptions > 0) return
    socket?.disconnect()
    socket = null
  }

  return {
    subscribeKlineUpdates({
      providerId,
      symbol,
      interval,
      mode = 'auto',
      pollIntervalMs = 10_000,
      onData,
      onError,
    }) {
      const client = getSocket()
      const requestId = `md_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
      let subscriptionId: string | null = null
      let closed = false
      activeSubscriptions += 1

      const handleSubscribed = (event: MarketDataSocketEvent) => {
        if (event.type !== 'subscribed' || event.requestId !== requestId) return
        subscriptionId = event.subscriptionId
      }

      const handleKline = (event: MarketDataSocketEvent) => {
        if (event.type !== 'kline') return
        if (event.providerId !== providerId) return
        if (event.symbol !== symbol || event.interval !== interval) return
        onData(event.data)
      }

      const handleError = (event: MarketDataSocketEvent) => {
        if (event.type !== 'error') return
        if (event.requestId && event.requestId !== requestId) return
        if (event.subscriptionId && event.subscriptionId !== subscriptionId) return
        onError?.(event.error)
      }

      client.on('subscribed', handleSubscribed)
      client.on('kline', handleKline)
      client.on('error', handleError)
      client.emit('subscribe', {
        requestId,
        channel: 'kline',
        providerId,
        symbol,
        interval,
        mode,
        pollIntervalMs,
      })

      return () => {
        if (closed) return
        closed = true
        client.off('subscribed', handleSubscribed)
        client.off('kline', handleKline)
        client.off('error', handleError)
        if (subscriptionId) {
          client.emit('unsubscribe', { subscriptionId })
        }
        releaseSocket()
      }
    },
    close() {
      activeSubscriptions = 0
      socket?.disconnect()
      socket = null
    },
  }
}
