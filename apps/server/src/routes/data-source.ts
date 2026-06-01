import { Hono } from 'hono'
import { prisma } from '@eous/db'
import { authMiddleware } from '../lib/auth-middleware.js'
import { encrypt, decrypt, getEncryptionKey } from '../lib/crypto-utils.js'
import {
  listDataSourceProviders,
  getDataSourceProvider,
} from '@eous/data-sources'

export const dataSourceRouter = new Hono()
export const dataSourceInstanceRouter = new Hono()

dataSourceRouter.use('*', authMiddleware)
dataSourceInstanceRouter.use('*', authMiddleware)

// ── GET /api/data-source-providers ──────────────────────────────────────
dataSourceRouter.get('/data-source-providers', (c) => {
  const providers = listDataSourceProviders().map((p) => ({
    id: p.id,
    name: p.name,
    configSchema: p.configSchema,
  }))
  return c.json({ providers })
})

// ── POST /api/data-source-instances ────────────────────────────────────
dataSourceInstanceRouter.post('/data-source-instances', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json<{
    name: string
    providerKind: string
    config: Record<string, string>
  }>()
  const { name, providerKind, config } = body

  if (!name || !providerKind || !config) {
    return c.json(
      { error: 'Missing required fields: name, providerKind, config' },
      400,
    )
  }

  const provider = getDataSourceProvider(providerKind)
  if (!provider) {
    return c.json({ error: `Unknown provider kind: ${providerKind}` }, 400)
  }

  const existing = await prisma.dataSourceInstance.findFirst({
    where: { userId, name },
  })
  if (existing) {
    return c.json(
      { error: 'Data source instance with this name already exists' },
      409,
    )
  }

  const { displayName: identityLabel, key: identityKey } =
    provider.resolveIdentity(config)

  const keyHex = getEncryptionKey()
  const { ciphertext, iv } = encrypt(JSON.stringify(config), keyHex)

  const instance = await prisma.dataSourceInstance.create({
    data: {
      name,
      providerKind,
      identityKey: identityKey || null,
      identityLabel: identityLabel || null,
      configEncrypted: ciphertext,
      configIv: iv,
      userId,
    },
    select: {
      id: true,
      name: true,
      providerKind: true,
      identityKey: true,
      identityLabel: true,
      createdAt: true,
    },
  })

  return c.json({ instance }, 201)
})

// ── GET /api/data-source-instances ─────────────────────────────────────
dataSourceInstanceRouter.get('/data-source-instances', async (c) => {
  const userId = c.get('userId')

  const instances = await prisma.dataSourceInstance.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      providerKind: true,
      identityKey: true,
      identityLabel: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return c.json({ instances })
})

// ── GET /api/data-source-instances/:id ─────────────────────────────────
dataSourceInstanceRouter.get('/data-source-instances/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const instance = await prisma.dataSourceInstance.findFirst({
    where: { id, userId },
    include: { trackedSymbols: true },
  })
  if (!instance) {
    return c.json({ error: 'Instance not found' }, 404)
  }

  const keyHex = getEncryptionKey()
  const config = JSON.parse(
    decrypt(instance.configEncrypted, instance.configIv, keyHex),
  ) as Record<string, string>

  return c.json({
    instance: {
      id: instance.id,
      name: instance.name,
      providerKind: instance.providerKind,
      config,
      trackedSymbols: instance.trackedSymbols,
      createdAt: instance.createdAt,
    },
  })
})

// ── PATCH /api/data-source-instances/:id ───────────────────────────────
dataSourceInstanceRouter.patch('/data-source-instances/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const body = await c.req.json<{
    name?: string
    config?: Record<string, string>
  }>()
  const { name, config } = body

  if (!name && !config) {
    return c.json({ error: 'At least one field must be provided' }, 400)
  }

  const existing = await prisma.dataSourceInstance.findFirst({
    where: { id, userId },
  })
  if (!existing) {
    return c.json({ error: 'Instance not found' }, 404)
  }

  if (name) {
    const conflict = await prisma.dataSourceInstance.findFirst({
      where: { userId, name, id: { not: id } },
    })
    if (conflict) {
      return c.json(
        { error: 'Data source instance with this name already exists' },
        409,
      )
    }
  }

  const updateData: Record<string, unknown> = {}
  if (name) updateData.name = name
  if (config) {
    const keyHex = getEncryptionKey()
    const { ciphertext, iv } = encrypt(JSON.stringify(config), keyHex)
    updateData.configEncrypted = ciphertext
    updateData.configIv = iv

    const provider = getDataSourceProvider(existing.providerKind)
    if (provider) {
      const { displayName: identityLabel, key: identityKey } =
        provider.resolveIdentity(config)
      updateData.identityKey = identityKey || null
      updateData.identityLabel = identityLabel || null
    }
  }

  const instance = await prisma.dataSourceInstance.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      providerKind: true,
      identityKey: true,
      identityLabel: true,
      createdAt: true,
    },
  })

  return c.json({ instance })
})

// ── DELETE /api/data-source-instances/:id ──────────────────────────────
dataSourceInstanceRouter.delete('/data-source-instances/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const existing = await prisma.dataSourceInstance.findFirst({
    where: { id, userId },
  })
  if (!existing) {
    return c.json({ error: 'Instance not found' }, 404)
  }

  await prisma.dataSourceInstance.delete({ where: { id } })

  return c.json({ ok: true })
})

// ── POST /api/data-source-instances/:id/search ─────────────────────────
dataSourceInstanceRouter.post(
  '/data-source-instances/:id/search',
  async (c) => {
    const userId = c.get('userId')
    const id = c.req.param('id')
    const body = await c.req.json<{ query: string }>()
    const { query } = body

    if (!query) {
      return c.json({ error: 'Missing required field: query' }, 400)
    }

    const instance = await prisma.dataSourceInstance.findFirst({
      where: { id, userId },
    })
    if (!instance) {
      return c.json({ error: 'Instance not found' }, 404)
    }

    const provider = getDataSourceProvider(instance.providerKind)
    if (!provider) {
      return c.json(
        { error: `Provider not found: ${instance.providerKind}` },
        500,
      )
    }

    const keyHex = getEncryptionKey()
    const config = JSON.parse(
      decrypt(instance.configEncrypted, instance.configIv, keyHex),
    ) as Record<string, string>

    const symbols = await provider.searchSymbols(query, config)
    return c.json({ symbols })
  },
)

// ── POST /api/data-source-instances/:id/test ───────────────────────────
dataSourceInstanceRouter.post(
  '/data-source-instances/:id/test',
  async (c) => {
    const userId = c.get('userId')
    const id = c.req.param('id')

    const instance = await prisma.dataSourceInstance.findFirst({
      where: { id, userId },
    })
    if (!instance) {
      return c.json({ error: 'Instance not found' }, 404)
    }

    const provider = getDataSourceProvider(instance.providerKind)
    if (!provider) {
      return c.json(
        { error: `Provider not found: ${instance.providerKind}` },
        500,
      )
    }

    const keyHex = getEncryptionKey()
    const config = JSON.parse(
      decrypt(instance.configEncrypted, instance.configIv, keyHex),
    ) as Record<string, string>

    try {
      await provider.getQuote('AAPL', config)
      return c.json({ ok: true })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown error'
      return c.json({ error: message })
    }
  },
)

// ── POST /api/data-source-instances/:id/klines ───────────────────────────
dataSourceInstanceRouter.post(
  '/data-source-instances/:id/klines',
  async (c) => {
    const userId = c.get('userId')
    const id = c.req.param('id')
    const body = await c.req.json<{
      symbol: string
      interval: string
      from?: number
      to?: number
    }>()
    const { symbol, interval, from, to } = body

    if (!symbol || !interval) {
      return c.json(
        { error: 'Missing required fields: symbol, interval' },
        400,
      )
    }

    const instance = await prisma.dataSourceInstance.findFirst({
      where: { id, userId },
    })
    if (!instance) {
      return c.json({ error: 'Instance not found' }, 404)
    }

    const provider = getDataSourceProvider(instance.providerKind)
    if (!provider) {
      return c.json(
        { error: `Provider not found: ${instance.providerKind}` },
        500,
      )
    }

    const keyHex = getEncryptionKey()
    const config = JSON.parse(
      decrypt(instance.configEncrypted, instance.configIv, keyHex),
    ) as Record<string, string>

    const now = Date.now()
    const klines = await provider.getKlines(
      {
        symbol,
        interval: interval as '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w',
        from: from ?? now - 365 * 24 * 60 * 60 * 1000,
        to: to ?? now,
      },
      config,
    )

    return c.json({ klines })
  },
)

// ── POST /api/data-source-instances/:id/symbols ────────────────────────
dataSourceInstanceRouter.post(
  '/data-source-instances/:id/symbols',
  async (c) => {
    const userId = c.get('userId')
    const id = c.req.param('id')
    const body = await c.req.json<{
      symbol: string
      name: string
      exchange?: string
      type?: string
    }>()
    const { symbol, name, exchange, type } = body

    if (!symbol || !name) {
      return c.json(
        { error: 'Missing required fields: symbol, name' },
        400,
      )
    }

    const instance = await prisma.dataSourceInstance.findFirst({
      where: { id, userId },
    })
    if (!instance) {
      return c.json({ error: 'Instance not found' }, 404)
    }

    const existing = await prisma.trackedSymbol.findFirst({
      where: { instanceId: id, symbol },
    })
    if (existing) {
      return c.json(
        { error: `Symbol "${symbol}" already tracked` },
        409,
      )
    }

    const tracked = await prisma.trackedSymbol.create({
      data: {
        instanceId: id,
        symbol,
        name,
        exchange: exchange ?? null,
        type: type ?? null,
      },
    })

    return c.json({ symbol: tracked }, 201)
  },
)

// ── DELETE /api/data-source-instances/:id/symbols/:symbolId ────────────
dataSourceInstanceRouter.delete(
  '/data-source-instances/:id/symbols/:symbolId',
  async (c) => {
    const userId = c.get('userId')
    const id = c.req.param('id')
    const symbolId = c.req.param('symbolId')

    const instance = await prisma.dataSourceInstance.findFirst({
      where: { id, userId },
    })
    if (!instance) {
      return c.json({ error: 'Instance not found' }, 404)
    }

    const tracked = await prisma.trackedSymbol.findFirst({
      where: { id: symbolId, instanceId: id },
    })
    if (!tracked) {
      return c.json({ error: 'Tracked symbol not found' }, 404)
    }

    await prisma.trackedSymbol.delete({ where: { id: symbolId } })

    return c.json({ ok: true })
  },
)
