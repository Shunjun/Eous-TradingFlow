import { AppError } from '../../lib/app-error.js'
import { encrypt, decrypt, getEncryptionKey } from '../../lib/crypto-utils.js'
import { fetchModelsFromProvider } from '../../lib/model-sync.js'
import * as providerRepo from '../../repositories/provider.repo.js'

const VALID_KINDS = [
  'openai',
  'anthropic',
  'deepseek',
  'kimi',
  'mimo',
  'glm',
  'google',
  'openrouter',
  'ollama',
  'custom',
] as const

const VALID_API_FORMATS = [
  'openai-chat',
  'openai-responses',
  'anthropic-messages',
  'google-generative',
] as const

function normalizeApiFormat(apiFormat?: string | null): string {
  return apiFormat && VALID_API_FORMATS.includes(apiFormat as (typeof VALID_API_FORMATS)[number])
    ? apiFormat
    : 'openai-chat'
}

export function listProviders(userId: string) {
  return providerRepo.findAllByUser(userId)
}

export async function getProvider(userId: string, id: string) {
  const provider = await providerRepo.findByIdAndUser(id, userId)
  if (!provider) {
    throw new AppError('Provider not found', 404)
  }

  const models = await providerRepo.findModelsByProvider(id)
  const parsedModels = models.map((m) => ({
    ...m,
    capabilities: JSON.parse(m.capabilities) as string[],
  }))

  return {
    provider: {
      id: provider.id,
      name: provider.name,
      kind: provider.kind,
      apiFormat: provider.apiFormat,
      baseUrl: provider.baseUrl,
      isActive: provider.isActive,
      createdAt: provider.createdAt,
    },
    models: parsedModels,
  }
}

export async function createProvider(
  userId: string,
  body: {
    name: string
    kind: string
    apiFormat?: string
    baseUrl: string
    apiKey: string
  },
) {
  const { name, kind, baseUrl, apiKey } = body
  const apiFormat = normalizeApiFormat(body.apiFormat)

  if (!name || !kind || !baseUrl) {
    throw new AppError('Missing required fields: name, kind, baseUrl', 400)
  }
  if (!VALID_KINDS.includes(kind as (typeof VALID_KINDS)[number])) {
    throw new AppError(`Invalid kind. Must be one of: ${VALID_KINDS.join(', ')}`, 400)
  }

  const existing = await providerRepo.findByNameAndUser(name, userId)
  if (existing) {
    throw new AppError('Provider with this name already exists', 409)
  }

  const keyHex = getEncryptionKey()
  const { ciphertext, iv } = encrypt(apiKey, keyHex)

  const provider = await providerRepo.create({
    name,
    kind,
    apiFormat,
    baseUrl,
    apiKeyEncrypted: ciphertext,
    apiKeyIv: iv,
    userId,
  })

  // Async fetch models — don't block the response on failure
  try {
    const models = await fetchModelsFromProvider(kind, baseUrl, apiKey, apiFormat)
    for (const m of models) {
      await providerRepo.upsertModel(provider.id, m)
    }
  } catch {
    // Model fetch failure should not prevent provider creation
  }

  return provider
}

export async function updateProvider(
  userId: string,
  id: string,
  body: {
    name?: string
    baseUrl?: string
    apiFormat?: string
    apiKey?: string
  },
) {
  const { name, baseUrl, apiKey } = body

  if (!name && !baseUrl && !apiKey && body.apiFormat === undefined) {
    throw new AppError('At least one field must be provided', 400)
  }

  const existing = await providerRepo.findByIdAndUser(id, userId)
  if (!existing) {
    throw new AppError('Provider not found', 404)
  }

  if (name) {
    const conflict = await providerRepo.findByNameAndUser(name, userId)
    if (conflict && conflict.id !== id) {
      throw new AppError('Provider with this name already exists', 409)
    }
  }

  const updateData: Record<string, string> = {}
  if (name) updateData.name = name
  if (baseUrl) updateData.baseUrl = baseUrl
  if (body.apiFormat !== undefined) updateData.apiFormat = normalizeApiFormat(body.apiFormat)
  if (apiKey) {
    const keyHex = getEncryptionKey()
    const { ciphertext, iv } = encrypt(apiKey, keyHex)
    updateData.apiKeyEncrypted = ciphertext
    updateData.apiKeyIv = iv
  }

  return providerRepo.update(id, updateData)
}

export async function deleteProvider(userId: string, id: string) {
  const existing = await providerRepo.findByIdAndUser(id, userId)
  if (!existing) {
    throw new AppError('Provider not found', 404)
  }

  await providerRepo.remove(id)
}

export async function syncModels(userId: string, id: string) {
  const provider = await providerRepo.findByIdAndUser(id, userId)
  if (!provider) {
    throw new AppError('Provider not found', 404)
  }

  const keyHex = getEncryptionKey()
  const apiKey = decrypt(provider.apiKeyEncrypted, provider.apiKeyIv, keyHex)

  const models = await fetchModelsFromProvider(
    provider.kind,
    provider.baseUrl,
    apiKey,
    provider.apiFormat,
  )

  let newCount = 0
  for (const m of models) {
    const existingModel = await providerRepo.findModel(id, m.modelId)
    if (existingModel) {
      await providerRepo.updateModel(existingModel.id, {
        displayName: m.displayName ?? existingModel.displayName,
        maxTokens: m.maxTokens ?? existingModel.maxTokens,
        capabilities: JSON.stringify(m.capabilities),
      })
    } else {
      await providerRepo.upsertModel(id, m)
      newCount++
    }
  }

  const allModels = await providerRepo.findModelsByProvider(id)
  const parsedModels = allModels.map((m) => ({
    ...m,
    capabilities: JSON.parse(m.capabilities) as string[],
  }))

  return { models: parsedModels, newCount }
}

export async function testConnection(userId: string, id: string) {
  const provider = await providerRepo.findByIdAndUser(id, userId)
  if (!provider) {
    throw new AppError('Provider not found', 404)
  }

  const keyHex = getEncryptionKey()
  const apiKey = decrypt(provider.apiKeyEncrypted, provider.apiKeyIv, keyHex)

  const models = await fetchModelsFromProvider(
    provider.kind,
    provider.baseUrl,
    apiKey,
    provider.apiFormat,
  )

  if (models.length > 0) {
    return { ok: true, modelCount: models.length }
  }
  throw new AppError('Connection failed', 400)
}

export async function updateModel(
  userId: string,
  providerId: string,
  modelId: string,
  body: {
    enabled?: boolean
    displayName?: string
    maxTokens?: number
    capabilities?: string[]
  },
) {
  const { enabled, displayName, maxTokens, capabilities } = body

  if (
    enabled === undefined &&
    displayName === undefined &&
    maxTokens === undefined &&
    capabilities === undefined
  ) {
    throw new AppError('At least one field must be provided', 400)
  }

  const provider = await providerRepo.findByIdAndUser(providerId, userId)
  if (!provider) {
    throw new AppError('Provider not found', 404)
  }

  const model = await providerRepo.findModel(providerId, modelId)
  if (!model) {
    throw new AppError('Model not found', 404)
  }

  const updateData: Record<string, unknown> = {}
  if (enabled !== undefined) updateData.enabled = enabled
  if (displayName !== undefined) updateData.displayName = displayName
  if (maxTokens !== undefined) updateData.maxTokens = maxTokens
  if (capabilities !== undefined) updateData.capabilities = JSON.stringify(capabilities)

  const updated = await providerRepo.updateModel(model.id, updateData)

  return {
    model: {
      ...updated,
      capabilities: JSON.parse(updated.capabilities) as string[],
    },
  }
}

export async function createModel(
  userId: string,
  providerId: string,
  body: {
    modelId: string
    displayName?: string
    maxTokens?: number
    capabilities?: string[]
  },
) {
  const { modelId, displayName, maxTokens, capabilities } = body

  if (!modelId) {
    throw new AppError('modelId is required', 400)
  }

  const provider = await providerRepo.findByIdAndUser(providerId, userId)
  if (!provider) {
    throw new AppError('Provider not found', 404)
  }

  const existing = await providerRepo.findModel(providerId, modelId)
  if (existing) {
    throw new AppError('Model already exists for this provider', 409)
  }

  const model = await providerRepo.createModel(providerId, {
    modelId,
    displayName,
    maxTokens,
    capabilities,
  })

  return {
    model: {
      ...model,
      capabilities: JSON.parse(model.capabilities) as string[],
    },
  }
}
