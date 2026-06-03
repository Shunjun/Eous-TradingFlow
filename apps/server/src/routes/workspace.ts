import { Hono } from 'hono'
import { prisma } from '@eous/db'
import { authMiddleware } from '../lib/auth-middleware.js'

export const workspaceRouter = new Hono()

workspaceRouter.get('/layout', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { workspaceLayout: true },
  })

  const layout = user?.workspaceLayout ? JSON.parse(user.workspaceLayout) : null
  return c.json({ layout })
})

workspaceRouter.put('/layout', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const { layout } = await c.req.json<{ layout: unknown }>()

  await prisma.user.update({
    where: { id: userId },
    data: { workspaceLayout: JSON.stringify(layout) },
  })

  return c.json({ ok: true })
})
