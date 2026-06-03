import { Hono } from 'hono'
import { authMiddleware } from '../lib/auth-middleware.js'
import { PROVIDER_TEMPLATES } from '../lib/provider-templates.js'
import * as providerService from '../services/provider.service.js'

export const providerRouter = new Hono()

providerRouter.use('*', authMiddleware)

providerRouter.get('/', async (c) => {
  const providers = await providerService.listProviders(c.get('userId'))
  return c.json({ providers })
})

providerRouter.get('/:id', async (c) => {
  const result = await providerService.getProvider(c.get('userId'), c.req.param('id'))
  return c.json(result)
})

providerRouter.post('/', async (c) => {
  const body = await c.req.json<{ name: string; kind: string; baseUrl: string; apiKey: string }>()
  const provider = await providerService.createProvider(c.get('userId'), body)
  return c.json({ provider }, 201)
})

providerRouter.patch('/:id', async (c) => {
  const body = await c.req.json<{ name?: string; baseUrl?: string; apiKey?: string }>()
  const provider = await providerService.updateProvider(c.get('userId'), c.req.param('id'), body)
  return c.json({ provider })
})

providerRouter.delete('/:id', async (c) => {
  await providerService.deleteProvider(c.get('userId'), c.req.param('id'))
  return c.json({ ok: true })
})

providerRouter.post('/:id/sync', async (c) => {
  const result = await providerService.syncModels(c.get('userId'), c.req.param('id'))
  return c.json(result)
})

providerRouter.post('/:id/test', async (c) => {
  const result = await providerService.testConnection(c.get('userId'), c.req.param('id'))
  return c.json(result)
})

providerRouter.patch('/:id/models/:modelId', async (c) => {
  const body = await c.req.json<{
    enabled?: boolean
    displayName?: string
    maxTokens?: number
    capabilities?: string[]
  }>()
  const result = await providerService.updateModel(
    c.get('userId'),
    c.req.param('id'),
    c.req.param('modelId'),
    body,
  )
  return c.json(result)
})

providerRouter.post('/:id/models', async (c) => {
  const body = await c.req.json<{
    modelId: string
    displayName?: string
    maxTokens?: number
    capabilities?: string[]
  }>()
  const result = await providerService.createModel(c.get('userId'), c.req.param('id'), body)
  return c.json(result)
})

// ── Provider Templates ────────────────────────────────────────────────────

export const templatesRouter = new Hono()

templatesRouter.get('/', (c) => {
  return c.json({ templates: PROVIDER_TEMPLATES })
})
