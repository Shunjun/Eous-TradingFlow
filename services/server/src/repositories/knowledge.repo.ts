import {
  prisma,
  type KnowledgeBase,
  type KnowledgeChunk,
  type KnowledgeDocument,
  type KnowledgeEmbeddingIndex,
  type KnowledgeIngestionRun,
} from '@eous/db'
import { randomUUID } from 'node:crypto'

export function findKnowledgeBasesByUser(userId: string): Promise<KnowledgeBase[]> {
  return prisma.knowledgeBase.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  })
}

export function findKnowledgeBaseByIdAndUser(
  id: string,
  userId: string,
): Promise<KnowledgeBase | null> {
  return prisma.knowledgeBase.findFirst({ where: { id, userId } })
}

export function createKnowledgeBase(data: {
  userId: string
  name: string
  description?: string | null
  metadata?: string
}): Promise<KnowledgeBase> {
  return prisma.knowledgeBase.create({
    data: {
      userId: data.userId,
      name: data.name,
      description: data.description ?? null,
      metadata: data.metadata ?? '{}',
    },
  })
}

export function updateKnowledgeBase(
  id: string,
  data: {
    name?: string
    description?: string | null
    enabled?: boolean
    metadata?: string
    activeIndexId?: string | null
  },
): Promise<KnowledgeBase> {
  return prisma.knowledgeBase.update({ where: { id }, data })
}

export async function deleteKnowledgeBase(id: string): Promise<void> {
  await prisma.knowledgeBase.delete({ where: { id } })
}

export function findDocumentsByKnowledgeBase(
  knowledgeBaseId: string,
): Promise<KnowledgeDocument[]> {
  return prisma.knowledgeDocument.findMany({
    where: { knowledgeBaseId },
    orderBy: { updatedAt: 'desc' },
  })
}

export function findDocumentByIdAndUser(
  id: string,
  userId: string,
): Promise<KnowledgeDocument | null> {
  return prisma.knowledgeDocument.findFirst({
    where: { id, knowledgeBase: { userId } },
  })
}

export function createDocument(data: {
  knowledgeBaseId: string
  title: string
  sourceType: string
  sourceUri?: string | null
  sourceFileName?: string | null
  sourceMimeType?: string | null
  sourceSize?: number | null
  sourceHash?: string | null
  strategy: string
  status?: string
  metadata?: string
}): Promise<KnowledgeDocument> {
  return prisma.knowledgeDocument.create({
    data: {
      knowledgeBaseId: data.knowledgeBaseId,
      title: data.title,
      sourceType: data.sourceType,
      sourceUri: data.sourceUri ?? null,
      sourceFileName: data.sourceFileName ?? null,
      sourceMimeType: data.sourceMimeType ?? null,
      sourceSize: data.sourceSize ?? null,
      sourceHash: data.sourceHash ?? null,
      strategy: data.strategy,
      status: data.status ?? 'uploaded',
      content: '',
      metadata: data.metadata ?? '{}',
    },
  })
}

export async function deleteDocument(id: string): Promise<void> {
  await prisma.knowledgeDocument.delete({ where: { id } })
}

export function findChunksByDocument(documentId: string): Promise<KnowledgeChunk[]> {
  return prisma.knowledgeChunk.findMany({
    where: { documentId },
    orderBy: { chunkIndex: 'asc' },
  })
}

export function findRunsByKnowledgeBase(knowledgeBaseId: string): Promise<KnowledgeIngestionRun[]> {
  return prisma.knowledgeIngestionRun.findMany({
    where: { knowledgeBaseId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function createChunkedRun(data: {
  knowledgeBaseId: string
  documentId: string
  strategy: string
  parseConfig?: string
  chunkConfig?: string
  compressionConfig?: string
  embeddingConfig?: string
  chunks: Array<{
    chunkIndex: number
    content: string
    tokenCount: number
    kind: string
    embeddingRole: string
    metadata?: string
  }>
}): Promise<KnowledgeIngestionRun> {
  return prisma.$transaction(async (tx) => {
    await tx.knowledgeChunk.deleteMany({ where: { documentId: data.documentId } })

    const run = await tx.knowledgeIngestionRun.create({
      data: {
        knowledgeBaseId: data.knowledgeBaseId,
        documentId: data.documentId,
        status: 'queued',
        strategy: data.strategy,
        parseConfig: data.parseConfig ?? '{}',
        chunkConfig: data.chunkConfig ?? '{}',
        compressionConfig: data.compressionConfig ?? '{}',
        embeddingConfig: data.embeddingConfig ?? '{}',
        startedAt: null,
        finishedAt: null,
      },
    })

    await tx.knowledgeChunk.createMany({
      data: data.chunks.map((chunk) => ({
        documentId: data.documentId,
        runId: run.id,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        kind: chunk.kind,
        embeddingRole: chunk.embeddingRole,
        metadata: chunk.metadata ?? '{}',
      })),
    })

    await tx.knowledgeDocument.update({
      where: { id: data.documentId },
      data: { status: 'queued' },
    })

    return run
  })
}

export function updateRunStatus(
  id: string,
  data: {
    status: string
    error?: string | null
    startedAt?: Date | null
    finishedAt?: Date | null
    embeddingConfig?: string
  },
): Promise<KnowledgeIngestionRun> {
  return prisma.knowledgeIngestionRun.update({ where: { id }, data })
}

export function updateDocumentStatus(id: string, status: string): Promise<KnowledgeDocument> {
  return prisma.knowledgeDocument.update({ where: { id }, data: { status } })
}

export function findChunksByRunAndRole(
  runId: string,
  embeddingRole: string,
): Promise<KnowledgeChunk[]> {
  return prisma.knowledgeChunk.findMany({
    where: { runId, embeddingRole },
    orderBy: { chunkIndex: 'asc' },
  })
}

export function createEmbeddingIndex(data: {
  knowledgeBaseId: string
  providerId: string
  modelId: string
  dimension: number
  chunkConfigHash?: string | null
  strategy: string
}): Promise<KnowledgeEmbeddingIndex> {
  return prisma.knowledgeEmbeddingIndex.create({
    data: {
      knowledgeBaseId: data.knowledgeBaseId,
      providerId: data.providerId,
      modelId: data.modelId,
      dimension: data.dimension,
      chunkConfigHash: data.chunkConfigHash ?? null,
      strategy: data.strategy,
      status: 'building',
    },
  })
}

export function updateEmbeddingIndex(
  id: string,
  data: { status: string },
): Promise<KnowledgeEmbeddingIndex> {
  return prisma.knowledgeEmbeddingIndex.update({ where: { id }, data })
}

export async function deleteEmbeddingsForIndex(indexId: string): Promise<void> {
  await prisma.knowledgeEmbedding.deleteMany({ where: { indexId } })
}

function vectorLiteral(vector: number[]): string {
  return `[${vector.map((value) => Number(value).toString()).join(',')}]`
}

export async function createEmbedding(data: {
  indexId: string
  chunkId: string
  vector: number[]
  metadata?: string
}): Promise<void> {
  await prisma.$executeRawUnsafe(
    'INSERT INTO "knowledge_embeddings" ("id", "index_id", "chunk_id", "vector", "metadata") VALUES ($1, $2, $3, $4::vector, $5) ON CONFLICT ("index_id", "chunk_id") DO UPDATE SET "vector" = EXCLUDED."vector", "metadata" = EXCLUDED."metadata"',
    randomUUID(),
    data.indexId,
    data.chunkId,
    vectorLiteral(data.vector),
    data.metadata ?? '{}',
  )
}

export async function activateEmbeddingIndex(
  knowledgeBaseId: string,
  indexId: string,
): Promise<void> {
  await prisma.knowledgeBase.update({
    where: { id: knowledgeBaseId },
    data: { activeIndexId: indexId },
  })
}
