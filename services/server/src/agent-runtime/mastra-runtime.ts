import { randomUUID } from 'node:crypto'
import { Agent } from '@mastra/core/agent'
import * as providerRepo from '../repositories/provider.repo.js'
import { decrypt, getEncryptionKey } from '../lib/crypto-utils.js'
import { planLlmRequest } from '../llm/planner.js'
import type { ProviderOptions } from '../llm/types.js'
import { mastraMemory } from './mastra-memory.js'
import { resolveAgentTools } from './skill-registry.js'
import type {
  AgentRuntime,
  RuntimeContext,
  RuntimeStream,
  RuntimeStreamEvent,
  RuntimeStreamOptions,
} from './types.js'

type MastraChunk = {
  type?: string
  payload?: Record<string, unknown>
}

function normalizeCreatedAt(createdAt: Date | string | number | undefined): Date {
  if (createdAt instanceof Date) return createdAt
  if (typeof createdAt === 'string' || typeof createdAt === 'number') {
    const date = new Date(createdAt)
    if (!Number.isNaN(date.getTime())) return date
  }
  return new Date()
}

function toMastraInput(context: RuntimeContext) {
  return context.messages
    .filter((message) => message.content.trim().length > 0)
    .map((message) => ({
      id: message.id ?? randomUUID(),
      role: message.role === 'tool' ? 'assistant' : message.role,
      content: message.content,
      createdAt: normalizeCreatedAt(message.createdAt),
      type: message.type ?? ('text' as const),
    }))
}

function normalizeBaseUrl(baseUrl: string): string | undefined {
  const trimmed = baseUrl.trim()
  if (!trimmed) return undefined
  return trimmed
}

function extractTextFromMessageContent(content: unknown): string | null {
  if (typeof content === 'string') return content

  if (Array.isArray(content)) {
    const parts = content
      .map((part) => {
        if (!part || typeof part !== 'object') return ''
        const record = part as Record<string, unknown>
        if (typeof record.text === 'string') return record.text
        if (typeof record.content === 'string') return record.content
        return ''
      })
      .filter(Boolean)

    return parts.length > 0 ? parts.join('') : null
  }

  if (content && typeof content === 'object') {
    const record = content as Record<string, unknown>
    if (typeof record.text === 'string') return record.text
    if (typeof record.content === 'string') return record.content
    if (typeof record.output === 'string') return record.output
  }

  return null
}

function extractTextFromBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null

  const record = body as Record<string, unknown>
  const direct = extractTextFromMessageContent(record.text ?? record.output)
  if (direct) return direct

  const choices = record.choices
  if (!Array.isArray(choices) || choices.length === 0) return null

  for (const choice of choices) {
    if (!choice || typeof choice !== 'object') continue
    const choiceRecord = choice as Record<string, unknown>
    const message = choiceRecord.message
    if (message && typeof message === 'object') {
      const messageRecord = message as Record<string, unknown>
      const messageText = extractTextFromMessageContent(messageRecord.content)
      if (messageText) return messageText
    }

    const text = extractTextFromMessageContent(choiceRecord.text)
    if (text) return text
  }

  return null
}

function extractTextFromOutput(output: unknown): string | null {
  if (!output || typeof output !== 'object') return null

  const record = output as Record<string, unknown>
  const direct = extractTextFromMessageContent(record.text ?? record.output)
  if (direct) return direct

  const response = record.response
  if (!response || typeof response !== 'object') return null

  const responseRecord = response as Record<string, unknown>
  const responseDirect = extractTextFromMessageContent(responseRecord.text ?? responseRecord.output)
  if (responseDirect) return responseDirect

  return extractTextFromBody(responseRecord.body)
}

function chunkToRuntimeEvent(chunk: MastraChunk): RuntimeStreamEvent | null {
  const payload = chunk.payload ?? {}

  if (chunk.type === 'text-delta') {
    const text = payload.text
    return typeof text === 'string' ? { type: 'text_delta', delta: text } : null
  }

  if (chunk.type === 'tool-call') {
    return {
      type: 'tool_call',
      toolCallId: String(payload.toolCallId ?? ''),
      toolName: String(payload.toolName ?? 'tool'),
      args: payload.args,
    }
  }

  if (chunk.type === 'tool-result' || chunk.type === 'tool-output') {
    return {
      type: 'tool_result',
      toolCallId: String(payload.toolCallId ?? ''),
      toolName: typeof payload.toolName === 'string' ? payload.toolName : undefined,
      result: payload.result ?? payload.output,
      isError: Boolean(payload.isError),
    }
  }

  if (chunk.type === 'tool-error') {
    return {
      type: 'tool_result',
      toolCallId: String(payload.toolCallId ?? ''),
      toolName: typeof payload.toolName === 'string' ? payload.toolName : undefined,
      result: payload.error,
      isError: true,
    }
  }

  if (chunk.type === 'finish') {
    const stepResult = payload.stepResult as { reason?: string } | undefined
    const output = payload.output as { usage?: unknown } | undefined
    return { type: 'finish', reason: stepResult?.reason, usage: output?.usage }
  }

  if (chunk.type === 'error') {
    const error = payload.error
    return {
      type: 'error',
      error: error instanceof Error ? error.message : String(error ?? 'Mastra stream error'),
    }
  }

  return null
}

async function* mapMastraStream(stream: AsyncIterable<MastraChunk>): RuntimeStream {
  for await (const chunk of stream) {
    const event = chunkToRuntimeEvent(chunk)
    if (event) yield event
  }
}

async function createMastraAgent(options: RuntimeStreamOptions): Promise<{
  agent: Agent
  providerOptions?: ProviderOptions
}> {
  const provider = await providerRepo.findByIdAndUser(options.providerId, options.userId)
  if (!provider) throw new Error('Provider not found')
  const providerModel = await providerRepo.findModel(provider.id, options.modelId)
  const capabilities = providerModel ? parseJsonStringArray(providerModel.capabilities) : []
  const plan = planLlmRequest(
    {
      providerKind: provider.kind,
      apiFormat: provider.apiFormat,
      baseUrl: provider.baseUrl,
      modelId: options.modelId,
      capabilities,
    },
    { thinkingLevel: options.options?.thinkingLevel },
  )

  const keyHex = getEncryptionKey()
  const apiKey = decrypt(provider.apiKeyEncrypted, provider.apiKeyIv, keyHex)
  const tools = resolveAgentTools({
    userId: options.userId,
    agentId: options.agentId,
    sessionId: options.sessionId,
    toolScope: options.toolScope,
  })

  return {
    providerOptions: plan.providerOptions,
    agent: new Agent({
      id: 'eous-runtime-agent',
      name: 'Eous Runtime Agent',
      instructions: options.context.systemPrompt || '',
      model: {
        providerId: plan.providerId,
        modelId: options.modelId,
        url: normalizeBaseUrl(provider.baseUrl),
        apiKey,
      },
      memory: mastraMemory,
      tools,
    }),
  }
}

function parseJsonStringArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

function outputToText(output: unknown): string {
  const text = extractTextFromOutput(output)
  return text ?? ''
}

export class MastraRuntime implements AgentRuntime {
  async streamChat(options: RuntimeStreamOptions): Promise<RuntimeStream> {
    const { agent, providerOptions } = await createMastraAgent(options)

    const output = await agent.stream(toMastraInput(options.context), {
      memory: options.conversationMemory
        ? {
            thread: options.conversationMemory.threadId,
            resource: options.conversationMemory.resourceId,
          }
        : undefined,
      savePerStep: Boolean(options.conversationMemory),
      modelSettings: {
        temperature: options.options?.temperature,
        maxOutputTokens: options.options?.maxTokens,
        topP: options.options?.topP,
      },
      providerOptions,
    })

    return mapMastraStream(output.fullStream as unknown as AsyncIterable<MastraChunk>)
  }

  async generateText(options: RuntimeStreamOptions): Promise<string> {
    const { agent, providerOptions } = await createMastraAgent(options)
    const output = await agent.generate(toMastraInput(options.context), {
      memory: options.conversationMemory
        ? {
            thread: options.conversationMemory.threadId,
            resource: options.conversationMemory.resourceId,
          }
        : undefined,
      savePerStep: Boolean(options.conversationMemory),
      modelSettings: {
        temperature: options.options?.temperature,
        maxOutputTokens: options.options?.maxTokens,
        topP: options.options?.topP,
      },
      providerOptions,
    })

    return outputToText(output)
  }
}
