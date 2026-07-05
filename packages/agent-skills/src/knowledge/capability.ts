export interface KnowledgeBaseRecord {
  id: string
  name: string
  description: string | null
  enabled: boolean
  activeIndexId: string | null
  updatedAt: string | Date
}

export interface KnowledgeRetrievalChunkRecord {
  chunkId: string
  documentId: string
  documentTitle: string
  chunkIndex: number
  content: string
  tokenCount: number
  score: number
  metadata: Record<string, unknown>
}

export interface KnowledgeRetrievalResultRecord {
  context: string
  chunks: KnowledgeRetrievalChunkRecord[]
  citations: Array<{
    chunkId: string
    documentId: string
    documentTitle: string
    chunkIndex: number
    score: number
  }>
}

export interface KnowledgeCapability {
  list(params: {
    userId: string
    query?: string
    limit?: number
    includeDisabled?: boolean
  }): Promise<KnowledgeBaseRecord[]>
  retrieve(params: {
    userId: string
    knowledgeBaseId: string
    query: string
    topK?: number
    scoreThreshold?: number
    maxContextTokens?: number
  }): Promise<KnowledgeRetrievalResultRecord>
}
