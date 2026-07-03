import { createHash } from 'node:crypto'
import { AppError } from '../../lib/app-error.js'
import { decrypt, getEncryptionKey } from '../../lib/crypto-utils.js'
import * as modelSettingsService from '../model-settings/model-settings.service.js'
import * as modelSettingsRepo from '../../repositories/model-settings.repo.js'
import * as knowledgeRepo from '../../repositories/knowledge.repo.js'
import * as notificationService from '../notification/notification.service.js'

type EmbeddingResponse = {
  data?: Array<{
    embedding?: number[]
  }>
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

function chunkConfigHash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

async function embedTexts(params: {
  baseUrl: string
  apiKey: string
  modelId: string
  texts: string[]
}): Promise<number[][]> {
  const res = await fetch(`${normalizeBaseUrl(params.baseUrl)}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.modelId,
      input: params.texts,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new AppError(`Embedding request failed: HTTP ${res.status}${body ? ` ${body}` : ''}`, 502)
  }

  const body = (await res.json()) as EmbeddingResponse
  const embeddings = body.data?.map((item) => item.embedding).filter(Boolean) as
    | number[][]
    | undefined

  if (!embeddings || embeddings.length !== params.texts.length) {
    throw new AppError('Embedding provider returned an invalid embedding response', 502)
  }

  return embeddings
}

async function resolveEmbeddingProvider(userId: string) {
  const modelRef = await modelSettingsService.resolveDefaultModel(userId, 'embedding')
  if (!modelRef) {
    throw new AppError(
      'Embedding model is not configured. Set a default embedding model first.',
      400,
    )
  }

  const model = await modelSettingsRepo.findProviderModelByUser(
    userId,
    modelRef.providerId,
    modelRef.modelId,
  )
  if (!model) throw new AppError('Embedding provider model not found or disabled', 400)

  const apiKey = decrypt(
    model.provider.apiKeyEncrypted,
    model.provider.apiKeyIv,
    getEncryptionKey(),
  )
  return {
    providerId: model.providerId,
    modelId: model.modelId,
    baseUrl: model.provider.baseUrl,
    apiKey,
  }
}

export function startEmbeddingRun(params: {
  userId: string
  runId: string
  knowledgeBaseId: string
  documentId: string
  documentTitle: string
}) {
  void processEmbeddingRun(params).catch((error) => {
    console.error('[knowledge embedding] background task failed', error)
  })
}

async function processEmbeddingRun(params: {
  userId: string
  runId: string
  knowledgeBaseId: string
  documentId: string
  documentTitle: string
}) {
  let indexId: string | null = null

  try {
    const provider = await resolveEmbeddingProvider(params.userId)
    const chunks = await knowledgeRepo.findChunksByRunAndRole(params.runId, 'indexed')
    if (chunks.length === 0) throw new AppError('No indexable chunks found for embedding', 400)

    await knowledgeRepo.updateRunStatus(params.runId, {
      status: 'embedding',
      startedAt: new Date(),
      finishedAt: null,
      embeddingConfig: JSON.stringify({
        providerId: provider.providerId,
        modelId: provider.modelId,
      }),
    })
    await knowledgeRepo.updateDocumentStatus(params.documentId, 'embedding')

    const firstEmbedding = (
      await embedTexts({
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        modelId: provider.modelId,
        texts: [chunks[0]?.content ?? ''],
      })
    )[0]
    if (!firstEmbedding) throw new AppError('Embedding provider returned no vector', 502)

    const index = await knowledgeRepo.createEmbeddingIndex({
      knowledgeBaseId: params.knowledgeBaseId,
      providerId: provider.providerId,
      modelId: provider.modelId,
      dimension: firstEmbedding.length,
      chunkConfigHash: chunkConfigHash(params.runId),
      strategy: 'raw',
    })
    indexId = index.id

    await knowledgeRepo.createEmbedding({
      indexId: index.id,
      chunkId: chunks[0]?.id ?? '',
      vector: firstEmbedding,
      metadata: JSON.stringify({ runId: params.runId }),
    })

    const batchSize = 32
    for (let offset = 1; offset < chunks.length; offset += batchSize) {
      const batch = chunks.slice(offset, offset + batchSize)
      const vectors = await embedTexts({
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        modelId: provider.modelId,
        texts: batch.map((chunk) => chunk.content),
      })

      for (let i = 0; i < batch.length; i += 1) {
        const chunk = batch[i]
        const vector = vectors[i]
        if (!chunk || !vector) continue
        if (vector.length !== firstEmbedding.length) {
          throw new AppError('Embedding provider returned inconsistent vector dimensions', 502)
        }
        await knowledgeRepo.createEmbedding({
          indexId: index.id,
          chunkId: chunk.id,
          vector,
          metadata: JSON.stringify({ runId: params.runId }),
        })
      }
    }

    await knowledgeRepo.updateEmbeddingIndex(index.id, { status: 'active' })
    await knowledgeRepo.activateEmbeddingIndex(params.knowledgeBaseId, index.id)
    await knowledgeRepo.updateRunStatus(params.runId, {
      status: 'indexed',
      finishedAt: new Date(),
      error: null,
    })
    await knowledgeRepo.updateDocumentStatus(params.documentId, 'indexed')

    await notificationService.createNotification(params.userId, {
      type: 'knowledge.index.completed',
      severity: 'success',
      title: '知识库向量化完成',
      message: `《${params.documentTitle}》已完成向量索引。`,
      entityType: 'knowledge_document',
      entityId: params.documentId,
      actionUrl: `/knowledge/${params.knowledgeBaseId}`,
      payload: {
        knowledgeBaseId: params.knowledgeBaseId,
        documentId: params.documentId,
        runId: params.runId,
        indexId: index.id,
        chunkCount: chunks.length,
        embeddingModel: provider.modelId,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (indexId) {
      await knowledgeRepo.updateEmbeddingIndex(indexId, { status: 'failed' }).catch(() => undefined)
    }
    await knowledgeRepo
      .updateRunStatus(params.runId, {
        status: 'failed',
        finishedAt: new Date(),
        error: message,
      })
      .catch(() => undefined)
    await knowledgeRepo.updateDocumentStatus(params.documentId, 'failed').catch(() => undefined)
    await notificationService
      .createNotification(params.userId, {
        type: 'knowledge.index.failed',
        severity: 'error',
        title: '知识库向量化失败',
        message: `《${params.documentTitle}》向量化失败：${message}`,
        entityType: 'knowledge_document',
        entityId: params.documentId,
        actionUrl: `/knowledge/${params.knowledgeBaseId}`,
        payload: {
          knowledgeBaseId: params.knowledgeBaseId,
          documentId: params.documentId,
          runId: params.runId,
          error: message,
        },
      })
      .catch(() => undefined)
  }
}
