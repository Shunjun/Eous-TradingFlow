import type { Notification } from '@eous/db'
import { AppError } from '../../lib/app-error.js'
import * as notificationRepo from '../../repositories/notification.repo.js'

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error'
export type NotificationStatusFilter = notificationRepo.NotificationStatusFilter

export type NotificationDTO = {
  id: string
  type: string
  severity: NotificationSeverity
  title: string
  message: string
  entityType: string | null
  entityId: string | null
  actionUrl: string | null
  payload: Record<string, unknown>
  readAt: string | null
  archivedAt: string | null
  createdAt: string
}

export type CreateNotificationInput = {
  type: string
  severity?: NotificationSeverity
  title: string
  message: string
  entityType?: string | null
  entityId?: string | null
  actionUrl?: string | null
  payload?: Record<string, unknown>
}

export type NotificationRealtimeEvent =
  | { type: 'notifications:created'; notification: NotificationDTO; unreadCount: number }
  | { type: 'notifications:updated'; notification: NotificationDTO; unreadCount: number }
  | { type: 'notifications:read-all'; unreadCount: number }
  | { type: 'notifications:unread-count'; unreadCount: number }

type Broadcaster = (userId: string, event: NotificationRealtimeEvent) => void

let broadcaster: Broadcaster | null = null

export function setNotificationBroadcaster(nextBroadcaster: Broadcaster | null) {
  broadcaster = nextBroadcaster
}

function parsePayload(payload: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(payload) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function normalizeSeverity(severity: string): NotificationSeverity {
  if (severity === 'success' || severity === 'warning' || severity === 'error') return severity
  return 'info'
}

export function toNotificationDTO(notification: Notification): NotificationDTO {
  return {
    id: notification.id,
    type: notification.type,
    severity: normalizeSeverity(notification.severity),
    title: notification.title,
    message: notification.message,
    entityType: notification.entityType,
    entityId: notification.entityId,
    actionUrl: notification.actionUrl,
    payload: parsePayload(notification.payload),
    readAt: notification.readAt?.toISOString() ?? null,
    archivedAt: notification.archivedAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  }
}

async function emitUnreadCount(userId: string) {
  const unreadCount = await notificationRepo.countUnreadNotifications(userId)
  broadcaster?.(userId, { type: 'notifications:unread-count', unreadCount })
  return unreadCount
}

export async function createNotification(userId: string, input: CreateNotificationInput) {
  const notification = await notificationRepo.createNotification({
    userId,
    type: input.type,
    severity: input.severity ?? 'info',
    title: input.title,
    message: input.message,
    entityType: input.entityType,
    entityId: input.entityId,
    actionUrl: input.actionUrl,
    payload: JSON.stringify(input.payload ?? {}),
  })
  const dto = toNotificationDTO(notification)
  const unreadCount = await notificationRepo.countUnreadNotifications(userId)
  broadcaster?.(userId, { type: 'notifications:created', notification: dto, unreadCount })
  return dto
}

export async function listNotifications(
  userId: string,
  params: {
    cursor?: string
    limit?: number
    status?: NotificationStatusFilter
    type?: string
  } = {},
) {
  const limit = Math.max(1, Math.min(params.limit ?? 30, 100))
  const rows = await notificationRepo.listNotifications({
    userId,
    cursor: params.cursor,
    limit,
    status: params.status,
    type: params.type,
  })
  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  return {
    notifications: items.map(toNotificationDTO),
    nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
  }
}

export async function getUnreadCount(userId: string) {
  return { unreadCount: await notificationRepo.countUnreadNotifications(userId) }
}

export async function markNotificationRead(userId: string, id: string) {
  const notification = await notificationRepo.markNotificationRead(userId, id)
  if (!notification) throw new AppError('Notification not found', 404)
  const dto = toNotificationDTO(notification)
  const unreadCount = await emitUnreadCount(userId)
  broadcaster?.(userId, { type: 'notifications:updated', notification: dto, unreadCount })
  return dto
}

export async function markAllNotificationsRead(userId: string) {
  await notificationRepo.markAllNotificationsRead(userId)
  const unreadCount = await emitUnreadCount(userId)
  broadcaster?.(userId, { type: 'notifications:read-all', unreadCount })
  return { unreadCount }
}

export async function archiveNotification(userId: string, id: string) {
  const notification = await notificationRepo.archiveNotification(userId, id)
  if (!notification) throw new AppError('Notification not found', 404)
  const dto = toNotificationDTO(notification)
  const unreadCount = await emitUnreadCount(userId)
  broadcaster?.(userId, { type: 'notifications:updated', notification: dto, unreadCount })
  return dto
}
