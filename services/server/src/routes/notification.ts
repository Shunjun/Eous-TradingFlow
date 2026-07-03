import { Hono } from 'hono'
import { authMiddleware } from '../lib/auth-middleware.js'
import * as notificationService from '../modules/notification/index.js'

export const notificationRouter = new Hono()

notificationRouter.use('*', authMiddleware)

notificationRouter.get('/', async (c) => {
  const status = c.req.query('status') as notificationService.NotificationStatusFilter | undefined
  const limitValue = Number(c.req.query('limit'))
  const result = await notificationService.listNotifications(c.get('userId'), {
    cursor: c.req.query('cursor'),
    limit: Number.isFinite(limitValue) ? limitValue : undefined,
    status,
    type: c.req.query('type'),
  })
  return c.json(result)
})

notificationRouter.get('/unread-count', async (c) => {
  const result = await notificationService.getUnreadCount(c.get('userId'))
  return c.json(result)
})

notificationRouter.post('/:id/read', async (c) => {
  const notification = await notificationService.markNotificationRead(
    c.get('userId'),
    c.req.param('id'),
  )
  return c.json({ notification })
})

notificationRouter.post('/read-all', async (c) => {
  const result = await notificationService.markAllNotificationsRead(c.get('userId'))
  return c.json(result)
})

notificationRouter.post('/:id/archive', async (c) => {
  const notification = await notificationService.archiveNotification(
    c.get('userId'),
    c.req.param('id'),
  )
  return c.json({ notification })
})
