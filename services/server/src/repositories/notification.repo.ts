import { prisma, type Notification } from '@eous/db'

export type NotificationStatusFilter = 'all' | 'unread' | 'read' | 'archived'

export type NotificationCreateData = {
  userId: string
  type: string
  severity?: string
  title: string
  message: string
  entityType?: string | null
  entityId?: string | null
  actionUrl?: string | null
  payload?: string
}

function statusWhere(status: NotificationStatusFilter | undefined) {
  if (status === 'unread') return { readAt: null, archivedAt: null }
  if (status === 'read') return { readAt: { not: null }, archivedAt: null }
  if (status === 'archived') return { archivedAt: { not: null } }
  return { archivedAt: null }
}

export function createNotification(data: NotificationCreateData): Promise<Notification> {
  return prisma.notification.create({
    data: {
      userId: data.userId,
      type: data.type,
      severity: data.severity ?? 'info',
      title: data.title,
      message: data.message,
      entityType: data.entityType ?? null,
      entityId: data.entityId ?? null,
      actionUrl: data.actionUrl ?? null,
      payload: data.payload ?? '{}',
    },
  })
}

export function listNotifications(params: {
  userId: string
  cursor?: string
  limit: number
  status?: NotificationStatusFilter
  type?: string
}): Promise<Notification[]> {
  return prisma.notification.findMany({
    where: {
      userId: params.userId,
      type: params.type,
      ...statusWhere(params.status),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: params.limit + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  })
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      userId,
      readAt: null,
      archivedAt: null,
    },
  })
}

export async function markNotificationRead(
  userId: string,
  id: string,
): Promise<Notification | null> {
  await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  })
  return prisma.notification.findFirst({ where: { id, userId } })
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null, archivedAt: null },
    data: { readAt: new Date() },
  })
  return result.count
}

export async function archiveNotification(
  userId: string,
  id: string,
): Promise<Notification | null> {
  await prisma.notification.updateMany({
    where: { id, userId, archivedAt: null },
    data: { archivedAt: new Date(), readAt: new Date() },
  })
  return prisma.notification.findFirst({ where: { id, userId } })
}
