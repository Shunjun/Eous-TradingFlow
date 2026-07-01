import type { KnowledgeBase, KnowledgeDocument } from '@eous/db'
import { AppError } from '../../lib/app-error.js'
import * as knowledgeRepo from '../../repositories/knowledge.repo.js'

export interface KnowledgeBaseDTO {
  id: string
  name: string
  description: string | null
  enabled: boolean
  metadata: Record<string, unknown>
  activeIndexId: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateKnowledgeBaseBody {
  name: string
  description?: string | null
  metadata?: Record<string, unknown>
}

export interface UpdateKnowledgeBaseBody {
  name?: string
  description?: string | null
  enabled?: boolean
  metadata?: Record<string, unknown>
  activeIndexId?: string | null
}

export interface KnowledgeDocumentDTO {
  id: string
  knowledgeBaseId: string
  title: string
  sourceType: string
  sourceUri: string | null
  sourceFileName: string | null
  sourceMimeType: string | null
  sourceSize: number | null
  sourceHash: string | null
  strategy: string
  status: string
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface CreateKnowledgeDocumentBody {
  title: string
  sourceType?: string
  sourceUri?: string | null
  sourceFileName?: string | null
  sourceMimeType?: string | null
  sourceSize?: number | null
  sourceHash?: string | null
  strategy?: 'raw' | 'compressed' | 'hybrid'
  metadata?: Record<string, unknown>
}

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function stringifyMetadata(metadata?: Record<string, unknown>): string | undefined {
  return metadata === undefined ? undefined : JSON.stringify(metadata)
}

function toDTO(base: KnowledgeBase): KnowledgeBaseDTO {
  return {
    id: base.id,
    name: base.name,
    description: base.description,
    enabled: base.enabled,
    metadata: parseJsonObject(base.metadata),
    activeIndexId: base.activeIndexId,
    createdAt: base.createdAt.toISOString(),
    updatedAt: base.updatedAt.toISOString(),
  }
}

function toDocumentDTO(document: KnowledgeDocument): KnowledgeDocumentDTO {
  return {
    id: document.id,
    knowledgeBaseId: document.knowledgeBaseId,
    title: document.title,
    sourceType: document.sourceType,
    sourceUri: document.sourceUri,
    sourceFileName: document.sourceFileName,
    sourceMimeType: document.sourceMimeType,
    sourceSize: document.sourceSize,
    sourceHash: document.sourceHash,
    strategy: document.strategy,
    status: document.status,
    metadata: parseJsonObject(document.metadata),
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  }
}

async function assertKnowledgeBase(userId: string, id: string): Promise<KnowledgeBase> {
  const base = await knowledgeRepo.findKnowledgeBaseByIdAndUser(id, userId)
  if (!base) throw new AppError('Knowledge base not found', 404)
  return base
}

export async function listKnowledgeBases(userId: string): Promise<KnowledgeBaseDTO[]> {
  return (await knowledgeRepo.findKnowledgeBasesByUser(userId)).map(toDTO)
}

export async function getKnowledgeBase(userId: string, id: string): Promise<KnowledgeBaseDTO> {
  return toDTO(await assertKnowledgeBase(userId, id))
}

export async function createKnowledgeBase(
  userId: string,
  body: CreateKnowledgeBaseBody,
): Promise<KnowledgeBaseDTO> {
  const name = body.name?.trim()
  if (!name) throw new AppError('Knowledge base name is required', 400)

  const base = await knowledgeRepo.createKnowledgeBase({
    userId,
    name,
    description: body.description?.trim() || null,
    metadata: stringifyMetadata(body.metadata),
  })

  return toDTO(base)
}

export async function updateKnowledgeBase(
  userId: string,
  id: string,
  body: UpdateKnowledgeBaseBody,
): Promise<KnowledgeBaseDTO> {
  await assertKnowledgeBase(userId, id)

  const data: Parameters<typeof knowledgeRepo.updateKnowledgeBase>[1] = {}
  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name) throw new AppError('Knowledge base name is required', 400)
    data.name = name
  }
  if (body.description !== undefined) data.description = body.description?.trim() || null
  if (body.enabled !== undefined) data.enabled = body.enabled
  if (body.metadata !== undefined) data.metadata = stringifyMetadata(body.metadata)
  if (body.activeIndexId !== undefined) data.activeIndexId = body.activeIndexId

  if (Object.keys(data).length === 0) {
    throw new AppError('At least one field must be provided', 400)
  }

  return toDTO(await knowledgeRepo.updateKnowledgeBase(id, data))
}

export async function deleteKnowledgeBase(userId: string, id: string): Promise<void> {
  await assertKnowledgeBase(userId, id)
  await knowledgeRepo.deleteKnowledgeBase(id)
}

export async function assertKnowledgeBaseAccess(userId: string, id: string): Promise<void> {
  await assertKnowledgeBase(userId, id)
}

export async function listKnowledgeDocuments(
  userId: string,
  knowledgeBaseId: string,
): Promise<KnowledgeDocumentDTO[]> {
  const base = await assertKnowledgeBase(userId, knowledgeBaseId)
  return (await knowledgeRepo.findDocumentsByKnowledgeBase(base.id)).map(toDocumentDTO)
}

export async function createKnowledgeDocument(
  userId: string,
  knowledgeBaseId: string,
  body: CreateKnowledgeDocumentBody,
): Promise<KnowledgeDocumentDTO> {
  const base = await assertKnowledgeBase(userId, knowledgeBaseId)
  const title = body.title?.trim()
  if (!title) throw new AppError('Document title is required', 400)

  const strategy = body.strategy ?? 'raw'
  if (!['raw', 'compressed', 'hybrid'].includes(strategy)) {
    throw new AppError('Invalid document strategy', 400)
  }

  const document = await knowledgeRepo.createDocument({
    knowledgeBaseId: base.id,
    title,
    sourceType: body.sourceType?.trim() || 'file',
    sourceUri: body.sourceUri?.trim() || null,
    sourceFileName: body.sourceFileName?.trim() || null,
    sourceMimeType: body.sourceMimeType?.trim() || null,
    sourceSize: body.sourceSize ?? null,
    sourceHash: body.sourceHash?.trim() || null,
    strategy,
    metadata: stringifyMetadata(body.metadata),
  })

  return toDocumentDTO(document)
}

export async function deleteKnowledgeDocument(userId: string, documentId: string): Promise<void> {
  const document = await knowledgeRepo.findDocumentByIdAndUser(documentId, userId)
  if (!document) throw new AppError('Knowledge document not found', 404)
  await knowledgeRepo.deleteDocument(document.id)
}
