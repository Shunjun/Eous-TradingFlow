import { listDataSourceProviders, getDataSourceProvider } from '@eous/data-sources'
import { AppError } from '../lib/app-error.js'
import { encrypt, decrypt, getEncryptionKey } from '../lib/crypto-utils.js'
import { parseIntervalMs } from '../lib/interval-utils.js'
import * as dsRepo from '../repositories/data-source.repo.js'

export function listProviders() {
  return listDataSourceProviders().map((p) => ({
    id: p.id,
    name: p.name,
    configSchema: p.configSchema,
  }))
}

export function listInstances(userId: string) {
  return dsRepo.findAllByUser(userId)
}

export async function getInstance(userId: string, id: string) {
  const instance = await dsRepo.findByIdWithSymbols(id, userId)
  if (!instance) {
    throw new AppError('Instance not found', 404)
  }

  const keyHex = getEncryptionKey()
  const config = JSON.parse(decrypt(instance.configEncrypted, instance.configIv, keyHex)) as Record<
    string,
    string
  >

  return {
    id: instance.id,
    name: instance.name,
    providerKind: instance.providerKind,
    config,
    trackedSymbols: instance.trackedSymbols,
    createdAt: instance.createdAt,
  }
}

export async function createInstance(
  userId: string,
  body: {
    name: string
    providerKind: string
    config: Record<string, string>
  },
) {
  const { name, providerKind, config } = body

  if (!name || !providerKind || !config) {
    throw new AppError('Missing required fields: name, providerKind, config', 400)
  }

  const provider = getDataSourceProvider(providerKind)
  if (!provider) {
    throw new AppError(`Unknown provider kind: ${providerKind}`, 400)
  }

  const existing = await dsRepo.findByNameAndUser(name, userId)
  if (existing) {
    throw new AppError('Data source instance with this name already exists', 409)
  }

  const { displayName: identityLabel, key: identityKey } = provider.resolveIdentity(config)

  const keyHex = getEncryptionKey()
  const { ciphertext, iv } = encrypt(JSON.stringify(config), keyHex)

  return dsRepo.create({
    name,
    providerKind,
    identityKey: identityKey || null,
    identityLabel: identityLabel || null,
    configEncrypted: ciphertext,
    configIv: iv,
    userId,
  })
}

export async function updateInstance(
  userId: string,
  id: string,
  body: {
    name?: string
    config?: Record<string, string>
  },
) {
  const { name, config } = body

  if (!name && !config) {
    throw new AppError('At least one field must be provided', 400)
  }

  const existing = await dsRepo.findByIdAndUser(id, userId)
  if (!existing) {
    throw new AppError('Instance not found', 404)
  }

  if (name) {
    const conflict = await dsRepo.findByNameAndUser(name, userId)
    if (conflict && conflict.id !== id) {
      throw new AppError('Data source instance with this name already exists', 409)
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
      const { displayName: identityLabel, key: identityKey } = provider.resolveIdentity(config)
      updateData.identityKey = identityKey || null
      updateData.identityLabel = identityLabel || null
    }
  }

  return dsRepo.update(id, updateData)
}

export async function deleteInstance(userId: string, id: string) {
  const existing = await dsRepo.findByIdAndUser(id, userId)
  if (!existing) {
    throw new AppError('Instance not found', 404)
  }

  await dsRepo.remove(id)
}

async function decryptInstance(instance: {
  configEncrypted: string
  configIv: string
  providerKind: string
}) {
  const keyHex = getEncryptionKey()
  const config = JSON.parse(decrypt(instance.configEncrypted, instance.configIv, keyHex)) as Record<
    string,
    string
  >

  const provider = getDataSourceProvider(instance.providerKind)
  if (!provider) {
    throw new AppError(`Provider not found: ${instance.providerKind}`, 500)
  }

  return { config, provider }
}

export async function getDefaultSymbols(userId: string, id: string, offset: number, limit: number) {
  const instance = await dsRepo.findByIdAndUser(id, userId)
  if (!instance) {
    throw new AppError('Instance not found', 404)
  }

  const { config, provider } = await decryptInstance(instance)
  return provider.getDefaultSymbols(offset, limit, config)
}

export async function searchSymbols(userId: string, id: string, query: string) {
  if (!query) {
    throw new AppError('Missing required field: query', 400)
  }

  const instance = await dsRepo.findByIdAndUser(id, userId)
  if (!instance) {
    throw new AppError('Instance not found', 404)
  }

  const { config, provider } = await decryptInstance(instance)
  return provider.searchSymbols(query, config)
}

export async function testConnection(userId: string, id: string) {
  const instance = await dsRepo.findByIdAndUser(id, userId)
  if (!instance) {
    throw new AppError('Instance not found', 404)
  }

  const { config, provider } = await decryptInstance(instance)
  const testSymbol = instance.providerKind === 'ccxt' ? 'BTC/USDT' : 'AAPL'
  await provider.getQuote(testSymbol, config)
  return { ok: true }
}

const DEFAULT_BAR_COUNT = 365

export async function getKlines(
  userId: string,
  id: string,
  body: {
    symbol: string
    interval: string
    from?: number
    to?: number
  },
) {
  const { symbol, interval, from, to } = body

  if (!symbol || !interval) {
    throw new AppError('Missing required fields: symbol, interval', 400)
  }

  const instance = await dsRepo.findByIdAndUser(id, userId)
  if (!instance) {
    throw new AppError('Instance not found', 404)
  }

  const { config, provider } = await decryptInstance(instance)

  const now = Date.now()
  const intervalMs = parseIntervalMs(interval)
  const defaultFrom = now - DEFAULT_BAR_COUNT * intervalMs

  return provider.getKlines({ symbol, interval, from: from ?? defaultFrom, to: to ?? now }, config)
}

export async function getIntervals(userId: string, id: string) {
  const instance = await dsRepo.findByIdAndUser(id, userId)
  if (!instance) {
    throw new AppError('Instance not found', 404)
  }

  const provider = getDataSourceProvider(instance.providerKind)
  if (!provider) {
    throw new AppError(`Provider not found: ${instance.providerKind}`, 500)
  }

  return provider.getSupportedIntervals()
}

export async function addSymbol(
  userId: string,
  id: string,
  body: {
    symbol: string
    name: string
    exchange?: string
    type?: string
  },
) {
  const { symbol, name, exchange, type } = body

  if (!symbol || !name) {
    throw new AppError('Missing required fields: symbol, name', 400)
  }

  const instance = await dsRepo.findByIdAndUser(id, userId)
  if (!instance) {
    throw new AppError('Instance not found', 404)
  }

  const existing = await dsRepo.findSymbol(id, symbol)
  if (existing) {
    throw new AppError(`Symbol "${symbol}" already tracked`, 409)
  }

  return dsRepo.createSymbol({
    instanceId: id,
    symbol,
    name,
    exchange: exchange ?? null,
    type: type ?? null,
  })
}

export async function removeSymbol(userId: string, id: string, symbolId: string) {
  const instance = await dsRepo.findByIdAndUser(id, userId)
  if (!instance) {
    throw new AppError('Instance not found', 404)
  }

  const tracked = await dsRepo.findSymbolByIdAndInstance(symbolId, id)
  if (!tracked) {
    throw new AppError('Tracked symbol not found', 404)
  }

  await dsRepo.deleteSymbol(symbolId)
}
