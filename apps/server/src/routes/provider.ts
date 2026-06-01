import { Hono } from 'hono'
import { prisma } from '@eous/db'
import { authMiddleware } from '../lib/auth-middleware.js'
import { encrypt, decrypt, getEncryptionKey } from '../lib/crypto-utils.js'
import { fetchModelsFromProvider } from '../lib/model-sync.js'
import { PROVIDER_TEMPLATES } from '../lib/provider-templates.js'

const VALID_KINDS = ['openai', 'anthropic', 'deepseek', 'ollama', 'custom'] as const

// ── Provider CRUD ─────────────────────────────────────────────────────────

export const providerRouter = new Hono()

providerRouter.use('*', authMiddleware)

// ── GET / ────────────────────────────────────────────────
providerRouter.get('/', async (c) => {
  const userId = c.get('userId')
  const providers = await prisma.provider.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      kind: true,
      baseUrl: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  return c.json({ providers })
})

// ── GET /:id ─────────────────────────────────────────────
providerRouter.get('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const provider = await prisma.provider.findFirst({
    where: { id, userId },
    select: {
      id: true,
      name: true,
      kind: true,
      baseUrl: true,
      isActive: true,
      createdAt: true,
    },
  })
  if (!provider) {
    return c.json({ error: 'Provider not found' }, 404)
  }

  const models = await prisma.providerModel.findMany({
    where: { providerId: id },
    select: {
      id: true,
      modelId: true,
      displayName: true,
      maxTokens: true,
      capabilities: true,
      enabled: true,
    },
  })

  const parsedModels = models.map((m) => ({
    ...m,
    capabilities: JSON.parse(m.capabilities) as string[],
  }))

  return c.json({ provider, models: parsedModels })
})

// ── POST / ───────────────────────────────────────────────
providerRouter.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json<{
    name: string
    kind: string
    baseUrl: string
    apiKey: string
  }>()
  const { name, kind, baseUrl, apiKey } = body

  if (!name || !kind || !baseUrl) {
    return c.json({ error: 'Missing required fields: name, kind, baseUrl' }, 400)
  }
  if (!VALID_KINDS.includes(kind as typeof VALID_KINDS[number])) {
    return c.json({ error: `Invalid kind. Must be one of: ${VALID_KINDS.join(', ')}` }, 400)
  }

  const existing = await prisma.provider.findFirst({
    where: { userId, name },
  })
  if (existing) {
    return c.json({ error: 'Provider with this name already exists' }, 409)
  }

  const keyHex = getEncryptionKey()
  const { ciphertext, iv } = encrypt(apiKey, keyHex)

  const provider = await prisma.provider.create({
    data: {
      name,
      kind,
      baseUrl,
      apiKeyEncrypted: ciphertext,
      apiKeyIv: iv,
      userId,
    },
    select: {
      id: true,
      name: true,
      kind: true,
      baseUrl: true,
      isActive: true,
      createdAt: true,
    },
  })

  // Async fetch models — don't block the response on failure
  try {
    const models = await fetchModelsFromProvider(kind, baseUrl, apiKey)
    for (const m of models) {
      await prisma.providerModel.upsert({
        where: { providerId_modelId: { providerId: provider.id, modelId: m.modelId } },
        create: {
          providerId: provider.id,
          modelId: m.modelId,
          displayName: m.displayName ?? null,
          maxTokens: m.maxTokens ?? null,
          capabilities: JSON.stringify(m.capabilities),
        },
        update: {},
      })
    }
  } catch {
    // Model fetch failure should not prevent provider creation
  }

  return c.json({ provider }, 201)
})

// ── PATCH /:id ───────────────────────────────────────────
providerRouter.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const body = await c.req.json<{
    name?: string
    baseUrl?: string
    apiKey?: string
  }>()
  const { name, baseUrl, apiKey } = body

  if (!name && !baseUrl && !apiKey) {
    return c.json({ error: 'At least one field must be provided' }, 400)
  }

  const existing = await prisma.provider.findFirst({ where: { id, userId } })
  if (!existing) {
    return c.json({ error: 'Provider not found' }, 404)
  }

  if (name) {
    const conflict = await prisma.provider.findFirst({
      where: { userId, name, id: { not: id } },
    })
    if (conflict) {
      return c.json({ error: 'Provider with this name already exists' }, 409)
    }
  }

  const updateData: Record<string, string> = {}
  if (name) updateData.name = name
  if (baseUrl) updateData.baseUrl = baseUrl
  if (apiKey) {
    const keyHex = getEncryptionKey()
    const { ciphertext, iv } = encrypt(apiKey, keyHex)
    updateData.apiKeyEncrypted = ciphertext
    updateData.apiKeyIv = iv
  }

  const provider = await prisma.provider.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      kind: true,
      baseUrl: true,
      isActive: true,
      createdAt: true,
    },
  })

  return c.json({ provider })
})

// ── DELETE /:id ──────────────────────────────────────────
providerRouter.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const existing = await prisma.provider.findFirst({ where: { id, userId } })
  if (!existing) {
    return c.json({ error: 'Provider not found' }, 404)
  }

  // ProviderModel has onDelete: Cascade, but explicit delete is clearer
  await prisma.providerModel.deleteMany({ where: { providerId: id } })
  await prisma.provider.delete({ where: { id } })

  return c.json({ ok: true })
})

// ── POST /:id/sync ──────────────────────────────────────
providerRouter.post('/:id/sync', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const provider = await prisma.provider.findFirst({ where: { id, userId } })
  if (!provider) {
    return c.json({ error: 'Provider not found' }, 404)
  }

  const keyHex = getEncryptionKey()
  const apiKey = decrypt(provider.apiKeyEncrypted, provider.apiKeyIv, keyHex)

  const models = await fetchModelsFromProvider(provider.kind, provider.baseUrl, apiKey)

  let newCount = 0
  for (const m of models) {
    const existingModel = await prisma.providerModel.findUnique({
      where: { providerId_modelId: { providerId: id, modelId: m.modelId } },
    })

    if (existingModel) {
      // Update non-state fields, preserve enabled status
      await prisma.providerModel.update({
        where: { id: existingModel.id },
        data: {
          displayName: m.displayName ?? existingModel.displayName,
          maxTokens: m.maxTokens ?? existingModel.maxTokens,
          capabilities: JSON.stringify(m.capabilities),
        },
      })
    } else {
      await prisma.providerModel.create({
        data: {
          providerId: id,
          modelId: m.modelId,
          displayName: m.displayName ?? null,
          maxTokens: m.maxTokens ?? null,
          capabilities: JSON.stringify(m.capabilities),
        },
      })
      newCount++
    }
  }

  const allModels = await prisma.providerModel.findMany({
    where: { providerId: id },
    select: {
      id: true,
      modelId: true,
      displayName: true,
      maxTokens: true,
      capabilities: true,
      enabled: true,
    },
  })

  const parsedModels = allModels.map((m) => ({
    ...m,
    capabilities: JSON.parse(m.capabilities) as string[],
  }))

  return c.json({ models: parsedModels, newCount })
})

// ── POST /:id/test ──────────────────────────────────────
providerRouter.post('/:id/test', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const provider = await prisma.provider.findFirst({ where: { id, userId } })
  if (!provider) {
    return c.json({ error: 'Provider not found' }, 404)
  }

  const keyHex = getEncryptionKey()
  const apiKey = decrypt(provider.apiKeyEncrypted, provider.apiKeyIv, keyHex)

  const models = await fetchModelsFromProvider(provider.kind, provider.baseUrl, apiKey)

  if (models.length > 0) {
    return c.json({ ok: true, modelCount: models.length })
  }
  return c.json({ error: 'Connection failed' })
})

// ── PATCH /:id/models/:modelId ──────────────────────────
providerRouter.patch('/:id/models/:modelId', async (c) => {
  const userId = c.get('userId')
  const providerId = c.req.param('id')
  const modelId = c.req.param('modelId')

  const provider = await prisma.provider.findFirst({ where: { id: providerId, userId } })
  if (!provider) {
    return c.json({ error: 'Provider not found' }, 404)
  }

  const body = await c.req.json<{
    enabled?: boolean
    displayName?: string
    maxTokens?: number
    capabilities?: string[]
  }>()
  const { enabled, displayName, maxTokens, capabilities } = body

  if (enabled === undefined && displayName === undefined && maxTokens === undefined && capabilities === undefined) {
    return c.json({ error: 'At least one field must be provided' }, 400)
  }

  const model = await prisma.providerModel.findUnique({
    where: { providerId_modelId: { providerId, modelId } },
  })
  if (!model) {
    return c.json({ error: 'Model not found' }, 404)
  }

  const updateData: Record<string, unknown> = {}
  if (enabled !== undefined) updateData.enabled = enabled
  if (displayName !== undefined) updateData.displayName = displayName
  if (maxTokens !== undefined) updateData.maxTokens = maxTokens
  if (capabilities !== undefined) updateData.capabilities = JSON.stringify(capabilities)

  const updated = await prisma.providerModel.update({
    where: { id: model.id },
    data: updateData,
    select: {
      id: true,
      modelId: true,
      displayName: true,
      maxTokens: true,
      capabilities: true,
      enabled: true,
    },
  })

  return c.json({
    model: {
      ...updated,
      capabilities: JSON.parse(updated.capabilities) as string[],
    },
  })
})

// ── POST /:id/models ────────────────────────────────────
providerRouter.post('/:id/models', async (c) => {
  const userId = c.get('userId')
  const providerId = c.req.param('id')

  const provider = await prisma.provider.findFirst({ where: { id: providerId, userId } })
  if (!provider) {
    return c.json({ error: 'Provider not found' }, 404)
  }

  const body = await c.req.json<{
    modelId: string
    displayName?: string
    maxTokens?: number
    capabilities?: string[]
  }>()
  const { modelId, displayName, maxTokens, capabilities } = body

  if (!modelId) {
    return c.json({ error: 'modelId is required' }, 400)
  }

  const existing = await prisma.providerModel.findUnique({
    where: { providerId_modelId: { providerId, modelId } },
  })
  if (existing) {
    return c.json({ error: 'Model already exists for this provider' }, 409)
  }

  const model = await prisma.providerModel.create({
    data: {
      providerId,
      modelId,
      displayName: displayName ?? null,
      maxTokens: maxTokens ?? null,
      capabilities: JSON.stringify(capabilities ?? []),
    },
    select: {
      id: true,
      modelId: true,
      displayName: true,
      maxTokens: true,
      capabilities: true,
      enabled: true,
    },
  })

  return c.json({
    model: {
      ...model,
      capabilities: JSON.parse(model.capabilities) as string[],
    },
  })
})

// ── Provider Templates ────────────────────────────────────────────────────

export const templatesRouter = new Hono()

templatesRouter.get('/', (c) => {
  return c.json({ templates: PROVIDER_TEMPLATES })
})
