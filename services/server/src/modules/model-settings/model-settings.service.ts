import type { UserModelSetting } from '@eous/db'
import { AppError } from '../../lib/app-error.js'
import * as modelSettingsRepo from '../../repositories/model-settings.repo.js'

type ModelPurpose = 'compression' | 'embedding'

export interface ModelRefDTO {
  providerId: string
  modelId: string
}

export interface UserModelSettingsDTO {
  compression: ModelRefDTO | null
  embedding: ModelRefDTO | null
}

export interface UpdateUserModelSettingsBody {
  compression?: ModelRefDTO | null
  embedding?: ModelRefDTO | null
}

function parseCapabilities(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

function toModelRef(providerId: string | null, modelId: string | null): ModelRefDTO | null {
  return providerId && modelId ? { providerId, modelId } : null
}

function toDTO(settings: UserModelSetting | null): UserModelSettingsDTO {
  return {
    compression: settings
      ? toModelRef(settings.compressionProviderId, settings.compressionModelId)
      : null,
    embedding: settings
      ? toModelRef(settings.embeddingProviderId, settings.embeddingModelId)
      : null,
  }
}

async function assertModelRef(
  userId: string,
  purpose: ModelPurpose,
  ref: ModelRefDTO | null | undefined,
): Promise<ModelRefDTO | null | undefined> {
  if (ref === undefined) return undefined
  if (ref === null) return null

  if (!ref.providerId || !ref.modelId) {
    throw new AppError('providerId and modelId are required for model settings', 400)
  }

  const model = await modelSettingsRepo.findProviderModelByUser(userId, ref.providerId, ref.modelId)
  if (!model) throw new AppError('Provider model not found or disabled', 400)

  const capabilities = parseCapabilities(model.capabilities)
  const isEmbedding = capabilities.includes('embedding')

  if (purpose === 'embedding' && !isEmbedding) {
    throw new AppError('Embedding default must use a model with embedding capability', 400)
  }

  if (purpose !== 'embedding' && isEmbedding) {
    throw new AppError('Compression default must use a non-embedding model', 400)
  }

  return ref
}

export async function getUserModelSettings(userId: string): Promise<UserModelSettingsDTO> {
  return toDTO(await modelSettingsRepo.findByUser(userId))
}

export async function updateUserModelSettings(
  userId: string,
  body: UpdateUserModelSettingsBody,
): Promise<UserModelSettingsDTO> {
  const [compression, embedding] = await Promise.all([
    assertModelRef(userId, 'compression', body.compression),
    assertModelRef(userId, 'embedding', body.embedding),
  ])

  const updateData: Parameters<typeof modelSettingsRepo.upsertForUser>[1] = {}

  if (compression !== undefined) {
    updateData.compressionProviderId = compression?.providerId ?? null
    updateData.compressionModelId = compression?.modelId ?? null
  }
  if (embedding !== undefined) {
    updateData.embeddingProviderId = embedding?.providerId ?? null
    updateData.embeddingModelId = embedding?.modelId ?? null
  }

  return toDTO(await modelSettingsRepo.upsertForUser(userId, updateData))
}

export async function resolveDefaultModel(
  userId: string,
  purpose: ModelPurpose,
): Promise<ModelRefDTO | null> {
  const settings = await modelSettingsRepo.findByUser(userId)
  const configured =
    purpose === 'compression'
      ? toModelRef(settings?.compressionProviderId ?? null, settings?.compressionModelId ?? null)
      : toModelRef(settings?.embeddingProviderId ?? null, settings?.embeddingModelId ?? null)

  if (configured) {
    const valid = await assertModelRef(userId, purpose, configured)
    return valid ?? null
  }

  return null
}
