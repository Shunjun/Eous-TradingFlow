import type { NotificationDTO, NotificationSocketEvent } from '@eous/api-client'
import { create } from 'zustand'
import { api, notificationSocket } from '../lib/api'

type ConnectionState = 'idle' | 'connected' | 'disconnected' | 'error'

type NotificationsState = {
  notifications: NotificationDTO[]
  unreadCount: number
  nextCursor: string | null
  loading: boolean
  connectionState: ConnectionState
  loadInitial: () => Promise<void>
  refreshOnOpen: () => Promise<void>
  loadMore: () => Promise<void>
  connect: () => () => void
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  archive: (id: string) => Promise<void>
  applySocketEvent: (event: NotificationSocketEvent) => void
}

function upsertNotification(
  notifications: NotificationDTO[],
  notification: NotificationDTO,
): NotificationDTO[] {
  const exists = notifications.some((item) => item.id === notification.id)
  const next = exists
    ? notifications.map((item) => (item.id === notification.id ? notification : item))
    : [notification, ...notifications]
  return next.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  nextCursor: null,
  loading: false,
  connectionState: 'idle',

  async loadInitial() {
    set({ loading: true })
    try {
      const [listResult, countResult] = await Promise.all([
        api.listNotifications({ limit: 30 }),
        api.getNotificationUnreadCount(),
      ])
      set({
        notifications: listResult.notifications,
        nextCursor: listResult.nextCursor,
        unreadCount: countResult.unreadCount,
      })
    } finally {
      set({ loading: false })
    }
  },

  async refreshOnOpen() {
    await get().loadInitial()
    if (!notificationSocket.isConnected()) {
      notificationSocket.reconnect()
    }
  },

  async loadMore() {
    const cursor = get().nextCursor
    if (!cursor || get().loading) return
    set({ loading: true })
    try {
      const result = await api.listNotifications({ cursor, limit: 30 })
      set((state) => ({
        notifications: [...state.notifications, ...result.notifications],
        nextCursor: result.nextCursor,
      }))
    } finally {
      set({ loading: false })
    }
  },

  connect() {
    const cleanup = notificationSocket.connect({
      onConnect: () => set({ connectionState: 'connected' }),
      onDisconnect: () => set({ connectionState: 'disconnected' }),
      onError: () => set({ connectionState: 'error' }),
      onEvent: (event) => get().applySocketEvent(event),
    })
    return cleanup
  },

  async markRead(id) {
    const result = await api.markNotificationRead(id)
    set((state) => ({
      notifications: upsertNotification(state.notifications, result.notification),
      unreadCount: Math.max(
        state.unreadCount - (state.notifications.find((item) => item.id === id)?.readAt ? 0 : 1),
        0,
      ),
    }))
  },

  async markAllRead() {
    const result = await api.markAllNotificationsRead()
    const now = new Date().toISOString()
    set((state) => ({
      unreadCount: result.unreadCount,
      notifications: state.notifications.map((item) =>
        item.readAt ? item : { ...item, readAt: now },
      ),
    }))
  },

  async archive(id) {
    const result = await api.archiveNotification(id)
    set((state) => ({
      notifications: state.notifications.filter((item) => item.id !== result.notification.id),
      unreadCount:
        result.notification.readAt === null
          ? Math.max(state.unreadCount - 1, 0)
          : state.unreadCount,
    }))
  },

  applySocketEvent(event) {
    if (event.type === 'notifications:created' || event.type === 'notifications:updated') {
      set((state) => ({
        notifications: upsertNotification(state.notifications, event.notification).filter(
          (item) => !item.archivedAt,
        ),
        unreadCount: event.unreadCount,
      }))
      return
    }
    if (event.type === 'notifications:read-all') {
      const now = new Date().toISOString()
      set((state) => ({
        unreadCount: event.unreadCount,
        notifications: state.notifications.map((item) =>
          item.readAt ? item : { ...item, readAt: now },
        ),
      }))
      return
    }
    set({ unreadCount: event.unreadCount })
  },
}))
