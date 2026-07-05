import type { KnowledgeBaseRecord, KnowledgeCapability } from '@eous/agent-skills'
import * as knowledgeService from './knowledge.service.js'

export class ServerKnowledgeCapability implements KnowledgeCapability {
  async list(params: {
    userId: string
    query?: string
    limit?: number
    includeDisabled?: boolean
  }): Promise<KnowledgeBaseRecord[]> {
    const knowledgeBases = await knowledgeService.listKnowledgeBases(params.userId)
    const query = params.query?.trim().toLowerCase()
    const filtered = knowledgeBases
      .filter((base) => params.includeDisabled || base.enabled)
      .filter((base) => {
        if (!query) return true
        return (
          base.name.toLowerCase().includes(query) ||
          (base.description?.toLowerCase().includes(query) ?? false)
        )
      })

    return filtered.slice(0, params.limit ?? 20)
  }

  retrieve(params: {
    userId: string
    knowledgeBaseId: string
    query: string
    topK?: number
    scoreThreshold?: number
    maxContextTokens?: number
  }) {
    return knowledgeService.retrieveKnowledge(params.userId, params.knowledgeBaseId, {
      query: params.query,
      topK: params.topK,
      scoreThreshold: params.scoreThreshold,
      maxContextTokens: params.maxContextTokens,
      retrievalMode: 'vector',
    })
  }
}

export const knowledgeCapability = new ServerKnowledgeCapability()
