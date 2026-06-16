import { getDataSourceProvider, listDataSourceProviders, type SymbolInfo } from '@eous/data-sources'
import type { ConfigFieldOption, ConfigFieldSchema } from '@eous/api-client'
import { AppError } from '../lib/app-error.js'
import { encrypt, decrypt, getEncryptionKey } from '../lib/crypto-utils.js'
import { parseIntervalMs } from '../lib/interval-utils.js'
import * as dsRepo from '../repositories/data-source.repo.js'

// ── Provider metadata (no ccxt import) ─────────────────────────────────────

export interface ProviderMetadata {
  id: string
  name: string
  configSchema: ConfigFieldSchema[]
}

export function listProviderMetadata(): ProviderMetadata[] {
  return listDataSourceProviders().map((provider) => ({
    id: provider.id,
    name: provider.name,
    configSchema: provider.configSchema,
  }))
}

function filterOptions(
  options: { label: string; value: string }[],
  query: string | undefined,
): { label: string; value: string }[] {
  const q = query?.trim().toLowerCase()
  if (!q) return options

  return options.filter(
    (option) => option.label.toLowerCase().includes(q) || option.value.toLowerCase().includes(q),
  )
}

function providerErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export async function getProviderConfigFieldOptions(
  providerId: string,
  fieldKey: string,
  query?: string,
): Promise<ConfigFieldOption[]> {
  const provider = getDataSourceProvider(providerId)
  if (!provider) {
    throw new AppError(`Unknown provider: ${providerId}`, 404)
  }

  const field = provider.configSchema.find((item) => item.key === fieldKey)
  if (!field) {
    throw new AppError(`Unknown config field: ${fieldKey}`, 404)
  }

  if (field.optionsSource?.source === 'provider') {
    if (!provider.getConfigFieldOptions) {
      throw new AppError(`Provider does not support dynamic options for: ${fieldKey}`, 400)
    }

    return provider.getConfigFieldOptions(fieldKey, query)
  }

  return filterOptions(field.options ?? [], query)
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
    defaultSymbol: instance.defaultSymbol,
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
    defaultSymbol: string
    config: Record<string, string>
  },
) {
  const { name, providerKind, config } = body
  const defaultSymbol = body.defaultSymbol?.trim()

  if (!name || !providerKind || !defaultSymbol || !config) {
    throw new AppError('Missing required fields: name, providerKind, defaultSymbol, config', 400)
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
    defaultSymbol,
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
    defaultSymbol?: string
    config?: Record<string, string>
  },
) {
  const { name, config } = body
  const defaultSymbol = body.defaultSymbol?.trim()

  if (!name && !defaultSymbol && !config) {
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
  if (defaultSymbol) updateData.defaultSymbol = defaultSymbol
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

export async function decryptInstance(instance: {
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

export async function getSymbolsForInstance(
  userId: string,
  id: string,
  query: string | undefined,
  offset = 0,
  limit = 50,
): Promise<{ symbols: SymbolInfo[]; total: number }> {
  const instance = await dsRepo.findByIdAndUser(id, userId)
  if (!instance) {
    throw new AppError('Instance not found', 404)
  }

  const { config, provider } = await decryptInstance(instance)

  try {
    if (query) {
      const symbols = await provider.searchSymbols(query, config)
      return { symbols, total: symbols.length }
    }
    return await provider.getDefaultSymbols(offset, limit, config)
  } catch (e) {
    throw new AppError(`Failed to fetch data source symbols: ${providerErrorMessage(e)}`, 502)
  }
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

  try {
    return await provider.getKlines(
      { symbol, interval, from: from ?? defaultFrom, to: to ?? now },
      config,
    )
  } catch (e) {
    throw new AppError(`Failed to fetch K-line data: ${providerErrorMessage(e)}`, 502)
  }
}

export async function getIntervalsForInstance(userId: string, id: string) {
  const instance = await dsRepo.findByIdAndUser(id, userId)
  if (!instance) {
    throw new AppError('Instance not found', 404)
  }

  const { config, provider } = await decryptInstance(instance)

  try {
    return await provider.getSupportedIntervals(config)
  } catch (e) {
    throw new AppError(`Failed to fetch data source intervals: ${providerErrorMessage(e)}`, 502)
  }
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
