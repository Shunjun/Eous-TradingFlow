import type { Server as HttpServer } from 'node:http'
import { Server as SocketIOServer, type Socket } from 'socket.io'
import {
  getUnreadCount,
  setNotificationBroadcaster,
} from '../modules/notification/notification.service.js'
import { authenticateSocketCookie } from './socket-auth.js'

interface AuthenticatedSocket extends Socket {
  data: Socket['data'] & {
    userId: string
  }
}

export function installNotificationSocket(io: SocketIOServer | HttpServer): SocketIOServer {
  const socketServer =
    io instanceof SocketIOServer
      ? io
      : new SocketIOServer(io, {
          path: '/ws',
          cors: {
            origin: true,
            credentials: true,
          },
        })

  const namespace = socketServer.of('/notifications')

  namespace.use(async (socket, next) => {
    try {
      const session = await authenticateSocketCookie(socket.handshake.headers.cookie)
      if (!session) {
        next(new Error('Unauthorized'))
        return
      }

      ;(socket as AuthenticatedSocket).data.userId = session.userId
      next()
    } catch (e) {
      next(e instanceof Error ? e : new Error(String(e)))
    }
  })

  namespace.on('connection', (socket) => {
    const client = socket as AuthenticatedSocket
    void getUnreadCount(client.data.userId)
      .then((result) => client.emit('notifications:unread-count', result))
      .catch((err) => {
        console.error('[socket.io notifications] unread count failed', err)
      })
  })

  setNotificationBroadcaster((userId, event) => {
    namespace.to(userId).emit(event.type, event)
  })

  namespace.on('connection', (socket) => {
    const client = socket as AuthenticatedSocket
    client.join(client.data.userId)
  })

  return socketServer
}
