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
  report: string
}

export type { ExecuteInput, ExecuteOutput }
