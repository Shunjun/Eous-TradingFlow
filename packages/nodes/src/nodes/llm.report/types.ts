interface ExecuteInput {
  providerId: string
  modelId: string
  systemPrompt: string
  userPrompt: string
  temperature?: number
  maxTokens?: number
  [key: string]: unknown
}

interface ExecuteOutput {
  report: string
}

export type { ExecuteInput, ExecuteOutput }
