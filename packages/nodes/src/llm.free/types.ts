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
  content: string
}

export type { ExecuteInput, ExecuteOutput }
