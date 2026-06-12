interface ExecuteInput {
  providerId: string
  modelId: string
  systemPrompt: string
  userPrompt: string
  injectMemory?: boolean
  memoryAgentId?: string
  memoryQuery?: string
  temperature?: number
  maxTokens?: number
  [key: string]: unknown
}

interface ExecuteOutput {
  signal: string
  confidence: number
  reasoning: string
}

export type { ExecuteInput, ExecuteOutput }
