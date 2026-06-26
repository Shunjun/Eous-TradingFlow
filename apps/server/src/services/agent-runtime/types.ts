export type RuntimeMessageRole = 'user' | 'assistant' | 'system' | 'tool'

export interface RuntimeMessage {
  role: RuntimeMessageRole
  content: string
  timestamp?: number
}

export interface RuntimeContext {
  systemPrompt?: string
  messages: RuntimeMessage[]
}

export interface RuntimeStreamSettings {
  temperature?: number
  maxTokens?: number
  topP?: number
  thinkingLevel?: 'off' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'
}

export type RuntimeStreamEvent =
  | { type: 'text_delta'; delta: string }
  | {
      type: 'tool_call'
      toolCallId: string
      toolName: string
      args?: unknown
    }
  | {
      type: 'tool_result'
      toolCallId: string
      toolName?: string
      result?: unknown
      isError?: boolean
    }
  | { type: 'finish'; reason?: string; usage?: unknown }
  | { type: 'error'; error: string }

export type RuntimeStream = AsyncIterable<RuntimeStreamEvent>

export interface RuntimeStreamOptions {
  userId: string
  agentId?: string
  sessionId?: string
  providerId: string
  modelId: string
  toolScope?: string[]
  memory?: {
    enabled?: boolean
    agentId?: string
    query?: string
    limit?: number
  }
  context: RuntimeContext
  options?: RuntimeStreamSettings
}

export interface AgentRuntime {
  streamChat(options: RuntimeStreamOptions): Promise<RuntimeStream>
  generateText(options: RuntimeStreamOptions): Promise<string>
}
