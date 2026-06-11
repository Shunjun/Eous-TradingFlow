import {
  getModel,
  stream,
  type AssistantMessageEventStream,
  type Context,
  type StreamOptions,
} from '@earendil-works/pi-ai'
import * as providerRepo from '../../repositories/provider.repo.js'
import { decrypt, getEncryptionKey } from '../../lib/crypto-utils.js'

const KIND_TO_PI_AI: Record<string, string> = {
  openai: 'openai',
  anthropic: 'anthropic',
  deepseek: 'deepseek',
  ollama: 'openai',
  custom: 'openai',
}

interface StreamChatOptions {
  userId: string
  providerId: string
  modelId: string
  context: Context
  options?: Partial<StreamOptions>
}

export async function streamChat({
  userId,
  providerId,
  modelId,
  context,
  options,
}: StreamChatOptions): Promise<AssistantMessageEventStream> {
  const provider = await providerRepo.findByIdAndUser(providerId, userId)
  if (!provider) throw new Error('Provider not found')

  const keyHex = getEncryptionKey()
  const apiKey = decrypt(provider.apiKeyEncrypted, provider.apiKeyIv, keyHex)

  const piAiProvider = KIND_TO_PI_AI[provider.kind] ?? 'openai'
  const model = getModel(piAiProvider as any, modelId as any)

  return stream(model, context, {
    apiKey,
    baseUrl: provider.baseUrl,
    ...options,
  })
}

/**
 * JSON tolerance chain for LLM outputs (doc/05-llm-integration.md §6):
 * 1. Direct JSON.parse
 * 2. Extract ```json ... ``` code block
 * 3. Extract { ... } object
 * 4. On failure, returns null (caller decides retry)
 */
export function parseJsonWithTolerance(text: string): unknown {
  // 1. Direct parse
  try {
    return JSON.parse(text)
  } catch {
    // continue
  }

  // 2. Extract ```json ... ``` code block
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim())
    } catch {
      // continue
    }
  }

  // 3. Extract { ... } object
  const objectMatch = text.match(/\{[\s\S]*\}/)
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0])
    } catch {
      // continue
    }
  }

  return null
}
