import { io, type Socket } from 'socket.io-client'
import type { NotificationDTO } from './index.js'

export type NotificationSocketEvent =
  | { type: 'notifications:created'; notification: NotificationDTO; unreadCount: number }
  | { type: 'notifications:updated'; notification: NotificationDTO; unreadCount: number }
  | { type: 'notifications:read-all'; unreadCount: number }
  | { type: 'notifications:unread-count'; unreadCount: number }

export interface NotificationSocketClient {
  connect(params: {
    onEvent: (event: NotificationSocketEvent) => void
    onConnect?: () => void
    onDisconnect?: () => void
    onError?: (error: string) => void
  }): () => void
  isConnected(): boolean
  reconnect(): void
  close(): void
}

export interface NotificationSocketOptions {
  baseURL?: string
}

function resolveSocketBaseURL(baseURL: string): string {
  if (baseURL.startsWith('http://') || baseURL.startsWith('https://')) return baseURL
  if (typeof window === 'undefined') return baseURL
  return new URL(baseURL, window.location.href).origin
}

export function createNotificationSocketClient(
  options: NotificationSocketOptions = {},
): NotificationSocketClient {
  const { baseURL = '/' } = options
  let socket: Socket | null = null

  const getSocket = () => {
    if (socket) return socket
    socket = io(`${resolveSocketBaseURL(baseURL)}/notifications`, {
      path: '/ws',
      withCredentials: true,
      transports: ['websocket', 'polling'],
    })
    return socket
  }

  return {
    connect({ onEvent, onConnect, onDisconnect, onError }) {
      const client = getSocket()
      const handleConnect = () => onConnect?.()
      const handleDisconnect = () => onDisconnect?.()
      const handleCreated = (event: NotificationSocketEvent) => onEvent(event)
      const handleUpdated = (event: NotificationSocketEvent) => onEvent(event)
      const handleReadAll = (event: NotificationSocketEvent) => onEvent(event)
      const handleUnreadCount = (event: { unreadCount: number }) =>
        onEvent({ type: 'notifications:unread-count', unreadCount: event.unreadCount })
      const handleError = (error: Error) => onError?.(error.message)

      client.on('connect', handleConnect)
      client.on('disconnect', handleDisconnect)
      client.on('connect_error', handleError)
      client.on('notifications:created', handleCreated)
      client.on('notifications:updated', handleUpdated)
      client.on('notifications:read-all', handleReadAll)
      client.on('notifications:unread-count', handleUnreadCount)

      return () => {
        client.off('connect', handleConnect)
        client.off('disconnect', handleDisconnect)
        client.off('connect_error', handleError)
        client.off('notifications:created', handleCreated)
        client.off('notifications:updated', handleUpdated)
        client.off('notifications:read-all', handleReadAll)
        client.off('notifications:unread-count', handleUnreadCount)
      }
    },
    isConnected() {
      return socket?.connected ?? false
    },
    reconnect() {
      const client = getSocket()
      if (client.connected) return
      client.connect()
    },
    close() {
      socket?.disconnect()
      socket = null
    },
  }
}
