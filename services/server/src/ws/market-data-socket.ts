import type { Server as HttpServer } from 'node:http'
import { Server as SocketIOServer, type Socket } from 'socket.io'
import { SESSION_COOKIE, validateSession } from '../lib/auth-utils.js'
import { AppError } from '../lib/app-error.js'
import {
  realtimeDataService,
  type RealtimeSubscribeMessage,
  type RealtimeUnsubscribeMessage,
} from '../modules/market-data/realtime-subscription.service.js'

interface AuthenticatedSocket extends Socket {
  data: Socket['data'] & {
    userId: string
    subscriptionIds: Set<string>
  }
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {}

  const cookies: Record<string, string> = {}
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index === -1) continue
    const key = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    if (key) cookies[key] = decodeURIComponent(value)
  }
  return cookies
}

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}

export function installMarketDataSocket(server: HttpServer): SocketIOServer {
  const io = new SocketIOServer(server, {
    path: '/ws',
    cors: {
      origin: true,
      credentials: true,
    },
  })

  const namespace = io.of('/market-data')

  namespace.use(async (socket, next) => {
    try {
      const token = parseCookies(socket.handshake.headers.cookie)[SESSION_COOKIE]
      if (!token) {
        next(new Error('Unauthorized'))
        return
      }

      const session = await validateSession(token)
      if (!session) {
        next(new Error('Unauthorized'))
        return
      }

      ;(socket as AuthenticatedSocket).data.userId = session.userId
      ;(socket as AuthenticatedSocket).data.subscriptionIds = new Set<string>()
      next()
    } catch (e) {
      next(e instanceof Error ? e : new Error(String(e)))
    }
  })

  namespace.on('connection', (socket) => {
    const client = socket as AuthenticatedSocket

    client.on('subscribe', (message: Omit<RealtimeSubscribeMessage, 'type'>) => {
      void (async () => {
        try {
          const subscription = await realtimeDataService.subscribe(
            client.data.userId,
            { ...message, type: 'subscribe' },
            (event) => {
              client.emit(event.type, event)
            },
          )
          client.data.subscriptionIds.add(subscription.subscriptionId)
          client.emit('subscribed', {
            requestId: message.requestId,
            ...subscription,
          })
        } catch (e) {
          client.emit('error', {
            type: 'error',
            requestId: message.requestId,
            error: e instanceof AppError ? e.message : toErrorMessage(e),
          })
          if (!(e instanceof AppError)) {
            console.error('[socket.io market-data] subscribe failed', e)
          }
        }
      })()
    })

    client.on('unsubscribe', (message: Omit<RealtimeUnsubscribeMessage, 'type'>) => {
      void (async () => {
        try {
          await realtimeDataService.unsubscribe(message.subscriptionId)
          client.data.subscriptionIds.delete(message.subscriptionId)
          client.emit('unsubscribed', {
            type: 'unsubscribed',
            requestId: message.requestId,
            subscriptionId: message.subscriptionId,
          })
        } catch (e) {
          client.emit('error', {
            type: 'error',
            requestId: message.requestId,
            subscriptionId: message.subscriptionId,
            error: toErrorMessage(e),
          })
        }
      })()
    })

    client.on('disconnect', () => {
      void realtimeDataService.unsubscribeAll(client.data.subscriptionIds)
    })
  })

  return io
}
