import { Hono } from 'hono'
import { authMiddleware } from '../lib/auth-middleware.js'
import { getDataSourceProvider } from '@eous/data-sources'
import * as dataSourceService from '../services/data-source.service.js'

export const dataSourceRouter = new Hono()
export const dataSourceInstanceRouter = new Hono()

dataSourceRouter.use('*', authMiddleware)
dataSourceInstanceRouter.use('*', authMiddleware)

// ── Provider metadata ───────────────────────────────────────────────────────

dataSourceRouter.get('/data-source-providers', (c) => {
  const providers = dataSourceService.listProviderMetadata()
  return c.json({ providers })
})

// ── Debug: direct fetch ─────────────────────────────────────────────────────

dataSourceRouter.post('/data-source-providers/:id/debug-fetch', async (c) => {
  const providerKind = c.req.param('id')
  const body = await c.req.json<{
    symbol: string
    interval: string
    config: Record<string, string>
  }>()

  const provider = getDataSourceProvider(providerKind)
  if (!provider) {
    return c.json({ error: `Unknown provider: ${providerKind}` }, 400)
  }

  const now = Date.now()
  const from = now - 90 * 86400000 // 90 天前
  const request = { symbol: body.symbol, interval: body.interval, from, to: now }

  console.log('[debug-fetch]', { providerKind, request, config: body.config })

  try {
    const klines = await provider.getKlines(request, body.config)
    console.log('[debug-fetch] result', { count: klines.length, sample: klines[0] })
    return c.json({ ok: true, count: klines.length, sample: klines[0] ?? null })
  } catch (e) {
    const err = e as Error
    console.error('[debug-fetch] error', { message: err.message, stack: err.stack })
    return c.json({ ok: false, error: err.message }, 500)
  }
})

// ── Instance CRUD ──────────────────────────────────────────────────────────

dataSourceInstanceRouter.post('/data-source-instances', async (c) => {
  const body = await c.req.json<{
    name: string
    providerKind: string
    config: Record<string, string>
  }>()
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

dataSourceInstanceRouter.post('/data-source-instances/:id/symbols', async (c) => {
  const body = await c.req.json<{ query?: string; offset?: number; limit?: number }>()
  const result = await dataSourceService.getSymbolsForInstance(
    c.get('userId'),
    c.req.param('id'),
    body.query,
    body.offset ?? 0,
    body.limit ?? 50,
  )
  return c.json(result)
})

dataSourceInstanceRouter.get('/data-source-instances/:id/intervals', async (c) => {
  const intervals = await dataSourceService.getIntervalsForInstance(c.get('userId'), c.req.param('id'))
  return c.json({ intervals })
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

// ── Tracked symbols ────────────────────────────────────────────────────────

dataSourceInstanceRouter.post('/data-source-instances/:id/tracked-symbols', async (c) => {
  const body = await c.req.json<{
    symbol: string
    name: string
    exchange?: string
    type?: string
  }>()
  const symbol = await dataSourceService.addSymbol(c.get('userId'), c.req.param('id'), body)
  return c.json({ symbol }, 201)
})

dataSourceInstanceRouter.delete('/data-source-instances/:id/tracked-symbols/:symbolId', async (c) => {
  await dataSourceService.removeSymbol(c.get('userId'), c.req.param('id'), c.req.param('symbolId'))
  return c.json({ ok: true })
})
