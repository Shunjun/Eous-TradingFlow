interface ExecuteInput {
  knowledgeBaseId: string
  query: string
  topK?: number
  scoreThreshold?: number
  maxContextTokens?: number
  retrievalMode?: 'vector' | 'hybrid'
  [key: string]: unknown
}

interface ExecuteOutput {
  context: string
  chunks: Array<Record<string, unknown>>
  citations: Array<Record<string, unknown>>
}

export type { ExecuteInput, ExecuteOutput }
