import { Hono } from 'hono'
import { authMiddleware } from '../lib/auth-middleware.js'
import * as workspaceService from '../services/workspace.service.js'

export const workspaceRouter = new Hono()

workspaceRouter.get('/layouts', authMiddleware, async (c) => {
  const result = await workspaceService.listLayouts(c.get('userId'))
  return c.json(result)
})

workspaceRouter.get('/layouts/:layoutId', authMiddleware, async (c) => {
  const layout = await workspaceService.getLayout(c.get('userId'), c.req.param('layoutId'))
  if (!layout) return c.json({ error: 'Layout not found' }, 404)
  return c.json({ layout })
})

workspaceRouter.post('/layouts', authMiddleware, async (c) => {
  const { name, setActive, copyFromId } = await c.req.json<{
    name: string
    setActive?: boolean
    copyFromId?: string
  }>()

  let schemaJson: string | undefined
  if (copyFromId) {
    const source = await workspaceService.getLayout(c.get('userId'), copyFromId)
    if (source) schemaJson = source.schemaJson
  }

  const result = await workspaceService.createLayout(c.get('userId'), {
    name,
    setActive,
    schemaJson,
  })
  return c.json(result)
})

workspaceRouter.put('/layouts/:layoutId', authMiddleware, async (c) => {
  const { schemaJson, name } = await c.req.json<{ schemaJson?: unknown; name?: string }>()
  await workspaceService.updateLayout(c.get('userId'), c.req.param('layoutId'), {
    schemaJson: schemaJson !== undefined ? JSON.stringify(schemaJson) : undefined,
    name,
  })
  return c.json({ ok: true })
})

workspaceRouter.delete('/layouts/:layoutId', authMiddleware, async (c) => {
  try {
    const result = await workspaceService.deleteLayout(c.get('userId'), c.req.param('layoutId'))
    return c.json({ ok: true, ...result })
  } catch (err) {
    if (err instanceof Error && err.message === 'Cannot delete the last layout') {
      return c.json({ error: err.message }, 400)
    }
    throw err
  }
})

workspaceRouter.post('/layouts/:layoutId/activate', authMiddleware, async (c) => {
  const result = await workspaceService.activateLayout(c.get('userId'), c.req.param('layoutId'))
  return c.json(result)
})
