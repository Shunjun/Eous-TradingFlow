interface ExecuteInput {
  providerId: string
  modelId: string
  systemPrompt?: string
  userPrompt: string
  responseFormat?: 'text' | 'markdown' | 'json_schema' | string
  schemaName?: string
  schemaJson?: string
  strictSchema?: boolean
  temperature?: number
  maxTokens?: number
  [key: string]: unknown
}

interface ExecuteOutput {
  content: string
  json?: Record<string, unknown> | unknown[]
  raw: string
}

export type { ExecuteInput, ExecuteOutput }
