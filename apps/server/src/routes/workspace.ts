import { Hono } from 'hono'
import { authMiddleware } from '../lib/auth-middleware.js'
import * as workspaceService from '../services/workspace.service.js'

export const workspaceRouter = new Hono()

workspaceRouter.get('/layout', authMiddleware, async (c) => {
  const layout = await workspaceService.getLayout(c.get('userId'))
  return c.json({ layout })
})

workspaceRouter.put('/layout', authMiddleware, async (c) => {
  const { layout } = await c.req.json<{ layout: unknown }>()
  await workspaceService.saveLayout(c.get('userId'), layout)
  return c.json({ ok: true })
})
