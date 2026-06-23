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

dataSourceRouter.get('/data-source-providers/:id/options/:fieldKey', async (c) => {
  const options = await dataSourceService.getProviderConfigFieldOptions(
    c.req.param('id'),
    c.req.param('fieldKey'),
    c.req.query('query'),
  )
  return c.json({ options })
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

  try {
    const klines = await provider.getKlines(request, body.config)
    return c.json({ ok: true, count: klines.length, sample: klines[0] ?? null })
  } catch (e) {
    const err = e as Error
    return c.json({ ok: false, error: err.message }, 500)
  }
})

// ── Instance CRUD ──────────────────────────────────────────────────────────

dataSourceInstanceRouter.post('/data-source-instances', async (c) => {
  const body = await c.req.json<{
    name: string
    providerKind: string
    defaultSymbol: string
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
  const body = await c.req.json<{
    name?: string
    defaultSymbol?: string
    config?: Record<string, string>
  }>()
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
  const intervals = await dataSourceService.getIntervalsForInstance(
    c.get('userId'),
    c.req.param('id'),
  )
  return c.json({ intervals })
})

dataSourceInstanceRouter.post('/data-source-instances/:id/interval-support', async (c) => {
  const body = await c.req.json<{ intervals: string[] }>()
  const intervals = await dataSourceService.getIntervalSupportForInstance(
    c.get('userId'),
    c.req.param('id'),
    body.intervals,
  )
  return c.json({ intervals })
})

dataSourceInstanceRouter.get('/data-source-instances/:id/realtime-capabilities', async (c) => {
  const capabilities = await dataSourceService.getRealtimeCapabilities(
    c.get('userId'),
    c.req.param('id'),
  )
  return c.json({ capabilities })
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

dataSourceInstanceRouter.get('/data-source-instances/:id/drawings', async (c) => {
  const drawing = await dataSourceService.getChartDrawing(
    c.get('userId'),
    c.req.param('id'),
    c.req.query('symbol') ?? '',
  )
  return c.json({ drawing })
})

dataSourceInstanceRouter.put('/data-source-instances/:id/drawings', async (c) => {
  const body = await c.req.json<{ drawings: { symbol: string; payload: string }[] }>()
  const result = await dataSourceService.saveChartDrawings(c.get('userId'), c.req.param('id'), body)
  return c.json(result)
})

dataSourceInstanceRouter.get('/chart/config', async (c) => {
  const config = await dataSourceService.getChartConfig(c.get('userId'))
  return c.json({ config })
})

dataSourceInstanceRouter.patch('/chart/config', async (c) => {
  const body = await c.req.json<{
    autoSaveDrawings?: boolean
    intervalSettings?: { visible: string[]; custom: { value: string; label?: string }[] }
  }>()
  const config = await dataSourceService.updateChartConfig(c.get('userId'), body)
  return c.json({ config })
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

dataSourceInstanceRouter.delete(
  '/data-source-instances/:id/tracked-symbols/:symbolId',
  async (c) => {
    await dataSourceService.removeSymbol(
      c.get('userId'),
      c.req.param('id'),
      c.req.param('symbolId'),
    )
    return c.json({ ok: true })
  },
)
