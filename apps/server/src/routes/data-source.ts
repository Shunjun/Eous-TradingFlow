import { Hono } from 'hono'
import { authMiddleware } from '../lib/auth-middleware.js'
import * as dataSourceService from '../services/data-source.service.js'

export const dataSourceRouter = new Hono()
export const dataSourceInstanceRouter = new Hono()

dataSourceRouter.use('*', authMiddleware)
dataSourceInstanceRouter.use('*', authMiddleware)

// ── Provider types ─────────────────────────────────────────────────────────

dataSourceRouter.get('/data-source-providers', (c) => {
  const providers = dataSourceService.listProviders()
  return c.json({ providers })
})

// ── Instance CRUD ──────────────────────────────────────────────────────────

dataSourceInstanceRouter.post('/data-source-instances', async (c) => {
  const body = await c.req.json<{ name: string; providerKind: string; config: Record<string, string> }>()
  const instance = await dataSourceService.createInstance(c.get('userId'), body)
  return c.json({ instance }, 201)
})

dataSourceInstanceRouter.get('/data-source-instances', async (c) => {
  const instances = await dataSourceService.listInstances(c.get('userId'))
  return c.json({ instances })
})

dataSourceInstanceRouter.get('/data-source-instances/:id', async (c) => {
  const instance = await dataSourceService.getInstance(c.get('userId'), c.req.param('id'))
  return c.json({ instance })
})

dataSourceInstanceRouter.patch('/data-source-instances/:id', async (c) => {
  const body = await c.req.json<{ name?: string; config?: Record<string, string> }>()
  const instance = await dataSourceService.updateInstance(c.get('userId'), c.req.param('id'), body)
  return c.json({ instance })
})

dataSourceInstanceRouter.delete('/data-source-instances/:id', async (c) => {
  await dataSourceService.deleteInstance(c.get('userId'), c.req.param('id'))
  return c.json({ ok: true })
})

// ── Instance operations ────────────────────────────────────────────────────

dataSourceInstanceRouter.post('/data-source-instances/:id/search', async (c) => {
  const body = await c.req.json<{ query?: string; offset?: number; limit?: number }>()
  if (body.query) {
    const symbols = await dataSourceService.searchSymbols(c.get('userId'), c.req.param('id'), body.query)
    return c.json({ symbols })
  }
  const offset = body.offset ?? 0
  const limit = body.limit ?? 50
  const result = await dataSourceService.getDefaultSymbols(c.get('userId'), c.req.param('id'), offset, limit)
  return c.json(result)
})

dataSourceInstanceRouter.post('/data-source-instances/:id/test', async (c) => {
  const result = await dataSourceService.testConnection(c.get('userId'), c.req.param('id'))
  return c.json(result)
})

dataSourceInstanceRouter.post('/data-source-instances/:id/klines', async (c) => {
  const body = await c.req.json<{
    symbol: string
    interval: string
    from?: number
    to?: number
  }>()
  const klines = await dataSourceService.getKlines(c.get('userId'), c.req.param('id'), body)
  return c.json({ klines })
})

dataSourceInstanceRouter.get('/data-source-instances/:id/intervals', async (c) => {
  const intervals = await dataSourceService.getIntervals(c.get('userId'), c.req.param('id'))
  return c.json({ intervals })
})

// ── Tracked symbols ────────────────────────────────────────────────────────

dataSourceInstanceRouter.post('/data-source-instances/:id/symbols', async (c) => {
  const body = await c.req.json<{ symbol: string; name: string; exchange?: string; type?: string }>()
  const symbol = await dataSourceService.addSymbol(c.get('userId'), c.req.param('id'), body)
  return c.json({ symbol }, 201)
})

dataSourceInstanceRouter.delete('/data-source-instances/:id/symbols/:symbolId', async (c) => {
  await dataSourceService.removeSymbol(c.get('userId'), c.req.param('id'), c.req.param('symbolId'))
  return c.json({ ok: true })
})
