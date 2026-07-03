import type {
  KnowledgeBase,
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgeIngestionRun,
} from '@eous/db'
import { createHash, randomUUID } from 'node:crypto'
import { extname } from 'node:path'
import { AppError } from '../../lib/app-error.js'
import { getKnowledgeObject, putKnowledgeObject } from '../../lib/object-storage.js'
import * as knowledgeRepo from '../../repositories/knowledge.repo.js'
import {
  previewChunks,
  type ChunkPreviewInput,
  type ChunkPreviewResult,
} from './chunking.service.js'
import { parseDocumentPreview, type ParsedDocumentPreview } from './document-parser.service.js'
import { embedTextsWithDefaultModel, startEmbeddingRun } from './embedding.service.js'
import { resolveDefaultModel } from '../model-settings/model-settings.service.js'

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

export interface KnowledgeChunkDTO {
  id: string
  documentId: string
  runId: string | null
  chunkIndex: number
  sourceRawChunkId: string | null
  compressedChunkId: string | null
  kind: string
  embeddingRole: string
  tokenCount: number
  content: string
  metadata: Record<string, unknown>
  createdAt: string
}

export interface KnowledgeIngestionRunDTO {
  id: string
  knowledgeBaseId: string
  documentId: string
  status: string
  strategy: string
  parseConfig: Record<string, unknown>
  chunkConfig: Record<string, unknown>
  compressionConfig: Record<string, unknown>
  embeddingConfig: Record<string, unknown>
  error: string | null
  startedAt: string | null
  finishedAt: string | null
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

export interface UploadKnowledgeDocumentInput {
  title?: string
  fileName: string
  mimeType?: string | null
  size: number
  buffer: Buffer
  strategy?: 'raw' | 'compressed' | 'hybrid'
  metadata?: Record<string, unknown>
}

export interface DocumentChunkPreviewInput {
  config?: ChunkPreviewInput['config']
}

export interface CreateIngestionRunBody {
  strategy?: 'raw' | 'compressed' | 'hybrid'
  parseConfig?: Record<string, unknown>
  chunkConfig?: Record<string, unknown>
  compressionConfig?: Record<string, unknown>
  embeddingConfig?: Record<string, unknown>
  chunks: Array<{
    content: string
    tokenCount?: number
    metadata?: Record<string, unknown>
  }>
}

export interface RetrieveKnowledgeBody {
  query: string
  topK?: number
  scoreThreshold?: number
  maxContextTokens?: number
  retrievalMode?: 'vector' | 'hybrid'
}

export interface KnowledgeRetrievalChunkDTO {
  chunkId: string
  documentId: string
  documentTitle: string
  chunkIndex: number
  content: string
  tokenCount: number
  score: number
  metadata: Record<string, unknown>
}

export interface KnowledgeCitationDTO {
  chunkId: string
  documentId: string
  documentTitle: string
  chunkIndex: number
  score: number
}

export interface KnowledgeRetrievalResultDTO {
  context: string
  chunks: KnowledgeRetrievalChunkDTO[]
  citations: KnowledgeCitationDTO[]
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

function getObjectStorageKey(document: KnowledgeDocument): string {
  const metadata = parseJsonObject(document.metadata)
  const objectStorage =
    metadata.objectStorage && typeof metadata.objectStorage === 'object'
      ? (metadata.objectStorage as Record<string, unknown>)
      : null
  const key = typeof objectStorage?.key === 'string' ? objectStorage.key : null

  if (!key) {
    throw new AppError('Document object storage key is missing', 400)
  }

  return key
}

function stringifyMetadata(metadata?: Record<string, unknown>): string | undefined {
  return metadata === undefined ? undefined : JSON.stringify(metadata)
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(Math.floor(parsed), max))
}

function estimateContextTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4))
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .trim()
    .replace(/[/\\]/g, '-')
    .replace(/[^\w.\-\u4e00-\u9fa5]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 160)
}

function titleFromFileName(fileName: string): string {
  const sanitized = sanitizeFileName(fileName)
  const extension = extname(sanitized)
  return (extension ? sanitized.slice(0, -extension.length) : sanitized).trim() || 'Untitled'
}

function validateStrategy(strategy: string): asserts strategy is 'raw' | 'compressed' | 'hybrid' {
  if (!['raw', 'compressed', 'hybrid'].includes(strategy)) {
    throw new AppError('Invalid document strategy', 400)
  }
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

function toChunkDTO(chunk: KnowledgeChunk): KnowledgeChunkDTO {
  return {
    id: chunk.id,
    documentId: chunk.documentId,
    runId: chunk.runId,
    chunkIndex: chunk.chunkIndex,
    sourceRawChunkId: chunk.sourceRawChunkId,
    compressedChunkId: chunk.compressedChunkId,
    kind: chunk.kind,
    embeddingRole: chunk.embeddingRole,
    tokenCount: chunk.tokenCount,
    content: chunk.content,
    metadata: parseJsonObject(chunk.metadata),
    createdAt: chunk.createdAt.toISOString(),
  }
}

function toRunDTO(run: KnowledgeIngestionRun): KnowledgeIngestionRunDTO {
  return {
    id: run.id,
    knowledgeBaseId: run.knowledgeBaseId,
    documentId: run.documentId,
    status: run.status,
    strategy: run.strategy,
    parseConfig: parseJsonObject(run.parseConfig),
    chunkConfig: parseJsonObject(run.chunkConfig),
    compressionConfig: parseJsonObject(run.compressionConfig),
    embeddingConfig: parseJsonObject(run.embeddingConfig),
    error: run.error,
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
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
  validateStrategy(strategy)

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

export async function uploadKnowledgeDocument(
  userId: string,
  knowledgeBaseId: string,
  input: UploadKnowledgeDocumentInput,
): Promise<KnowledgeDocumentDTO> {
  const base = await assertKnowledgeBase(userId, knowledgeBaseId)
  const fileName = sanitizeFileName(input.fileName)
  if (!fileName) throw new AppError('File name is required', 400)
  if (input.size <= 0) throw new AppError('Uploaded file is empty', 400)
  if (input.size > 50 * 1024 * 1024) {
    throw new AppError('Uploaded file exceeds the 50MB limit', 400)
  }

  const strategy = input.strategy ?? 'raw'
  validateStrategy(strategy)

  const sourceHash = createHash('sha256').update(input.buffer).digest('hex')
  const key = [
    'knowledge-bases',
    base.id,
    'documents',
    `${Date.now()}-${randomUUID()}-${fileName}`,
  ].join('/')
  const storedObject = await putKnowledgeObject({
    key,
    body: input.buffer,
    contentType: input.mimeType,
    metadata: {
      knowledgeBaseId: base.id,
      sourceHash,
    },
  })

  const document = await knowledgeRepo.createDocument({
    knowledgeBaseId: base.id,
    title: input.title?.trim() || titleFromFileName(fileName),
    sourceType: 'file',
    sourceUri: storedObject.uri,
    sourceFileName: fileName,
    sourceMimeType: input.mimeType?.trim() || null,
    sourceSize: input.size,
    sourceHash,
    strategy,
    status: 'uploaded',
    metadata: stringifyMetadata({
      ...(input.metadata ?? {}),
      objectStorage: {
        bucket: storedObject.bucket,
        key: storedObject.key,
        etag: storedObject.etag,
      },
    }),
  })

  return toDocumentDTO(document)
}

export async function deleteKnowledgeDocument(userId: string, documentId: string): Promise<void> {
  const document = await knowledgeRepo.findDocumentByIdAndUser(documentId, userId)
  if (!document) throw new AppError('Knowledge document not found', 404)
  await knowledgeRepo.deleteDocument(document.id)
}

async function getDocumentForUser(userId: string, documentId: string): Promise<KnowledgeDocument> {
  const document = await knowledgeRepo.findDocumentByIdAndUser(documentId, userId)
  if (!document) throw new AppError('Knowledge document not found', 404)
  return document
}

export async function previewKnowledgeDocumentParse(
  userId: string,
  documentId: string,
): Promise<ParsedDocumentPreview> {
  const document = await getDocumentForUser(userId, documentId)
  const buffer = await getKnowledgeObject(getObjectStorageKey(document))

  return parseDocumentPreview({
    buffer,
    fileName: document.sourceFileName,
    mimeType: document.sourceMimeType,
  })
}

export async function previewKnowledgeDocumentChunks(
  userId: string,
  documentId: string,
  input: DocumentChunkPreviewInput,
): Promise<ChunkPreviewResult> {
  const parsed = await previewKnowledgeDocumentParse(userId, documentId)
  return previewChunks({
    content: parsed.content,
    config: input.config,
  })
}

export async function listKnowledgeDocumentChunks(
  userId: string,
  documentId: string,
): Promise<KnowledgeChunkDTO[]> {
  await getDocumentForUser(userId, documentId)
  return (await knowledgeRepo.findChunksByDocument(documentId)).map(toChunkDTO)
}

export async function listKnowledgeIngestionRuns(
  userId: string,
  knowledgeBaseId: string,
): Promise<KnowledgeIngestionRunDTO[]> {
  const base = await assertKnowledgeBase(userId, knowledgeBaseId)
  return (await knowledgeRepo.findRunsByKnowledgeBase(base.id)).map(toRunDTO)
}

export async function createKnowledgeIngestionRun(
  userId: string,
  documentId: string,
  body: CreateIngestionRunBody,
): Promise<{ run: KnowledgeIngestionRunDTO; chunks: KnowledgeChunkDTO[] }> {
  const document = await getDocumentForUser(userId, documentId)
  const strategy = body.strategy ?? (document.strategy as 'raw' | 'compressed' | 'hybrid')
  validateStrategy(strategy)
  if (strategy !== 'raw') {
    throw new AppError('Compressed and hybrid indexing are not implemented yet', 400)
  }
  const embeddingModel = await resolveDefaultModel(userId, 'embedding')
  if (!embeddingModel) {
    throw new AppError(
      'Embedding model is not configured. Set a default embedding model first.',
      400,
    )
  }

  if (!Array.isArray(body.chunks) || body.chunks.length === 0) {
    throw new AppError('At least one chunk is required', 400)
  }
  if (body.chunks.length > 2000) {
    throw new AppError('Too many chunks. Reduce maxChunks before starting ingestion.', 400)
  }

  const chunks = body.chunks.map((chunk, index) => {
    const content = chunk.content.trim()
    if (!content) throw new AppError(`Chunk ${index + 1} is empty`, 400)
    return {
      chunkIndex: index,
      content,
      tokenCount: chunk.tokenCount ?? Math.max(1, Math.ceil(content.length / 4)),
      kind: 'raw',
      embeddingRole: strategy === 'raw' ? 'indexed' : 'context',
      metadata: stringifyMetadata(chunk.metadata),
    }
  })

  const run = await knowledgeRepo.createChunkedRun({
    knowledgeBaseId: document.knowledgeBaseId,
    documentId: document.id,
    strategy,
    parseConfig: stringifyMetadata(body.parseConfig),
    chunkConfig: stringifyMetadata(body.chunkConfig),
    compressionConfig: stringifyMetadata(body.compressionConfig),
    embeddingConfig: stringifyMetadata({
      ...(body.embeddingConfig ?? {}),
      providerId: embeddingModel.providerId,
      modelId: embeddingModel.modelId,
    }),
    chunks,
  })

  startEmbeddingRun({
    userId,
    runId: run.id,
    knowledgeBaseId: document.knowledgeBaseId,
    documentId: document.id,
    documentTitle: document.title,
  })

  return {
    run: toRunDTO(run),
    chunks: (await knowledgeRepo.findChunksByDocument(document.id)).map(toChunkDTO),
  }
}

export async function retrieveKnowledge(
  userId: string,
  knowledgeBaseId: string,
  body: RetrieveKnowledgeBody,
): Promise<KnowledgeRetrievalResultDTO> {
  const base = await assertKnowledgeBase(userId, knowledgeBaseId)
  const query = body.query?.trim()
  if (!query) throw new AppError('Query is required', 400)
  if (body.retrievalMode === 'hybrid') {
    throw new AppError('Hybrid retrieval is not implemented yet', 400)
  }

  const index = await knowledgeRepo.getActiveEmbeddingIndex(base.id)
  if (!index) throw new AppError('Knowledge base does not have an active embedding index', 400)

  const topK = clampInt(body.topK, 5, 1, 50)
  const maxContextTokens = clampInt(body.maxContextTokens, 2000, 128, 20000)
  const threshold =
    typeof body.scoreThreshold === 'number' && Number.isFinite(body.scoreThreshold)
      ? body.scoreThreshold
      : 0

  const { vectors } = await embedTextsWithDefaultModel(userId, [query])
  const queryVector = vectors[0]
  if (!queryVector) throw new AppError('Failed to generate query embedding', 502)
  if (queryVector.length !== index.dimension) {
    throw new AppError(
      `Query embedding dimension ${queryVector.length} does not match active index dimension ${index.dimension}`,
      400,
    )
  }

  const rows = (
    await knowledgeRepo.searchEmbeddingIndex({
      indexId: index.id,
      vector: queryVector,
      limit: topK * 3,
    })
  )
    .filter((row) => row.score >= threshold)
    .slice(0, topK)

  const chunks: KnowledgeRetrievalChunkDTO[] = []
  let usedTokens = 0
  for (const row of rows) {
    const tokenCount = row.tokenCount || estimateContextTokens(row.content)
    if (chunks.length > 0 && usedTokens + tokenCount > maxContextTokens) continue
    usedTokens += tokenCount
    chunks.push({
      chunkId: row.chunkId,
      documentId: row.documentId,
      documentTitle: row.documentTitle,
      chunkIndex: row.chunkIndex,
      content: row.content,
      tokenCount,
      score: row.score,
      metadata: parseJsonObject(row.metadata),
    })
  }

  return {
    context: chunks
      .map(
        (chunk, index) =>
          `[${index + 1}] ${chunk.documentTitle} / Chunk ${chunk.chunkIndex + 1}\n${chunk.content}`,
      )
      .join('\n\n'),
    chunks,
    citations: chunks.map((chunk) => ({
      chunkId: chunk.chunkId,
      documentId: chunk.documentId,
      documentTitle: chunk.documentTitle,
      chunkIndex: chunk.chunkIndex,
      score: chunk.score,
    })),
  }
}
