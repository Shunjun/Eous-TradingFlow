import type { ModelDiscoveryInput, SyncModel } from '../model-discovery.js'
import { inferDefaultModelCapabilities } from '../model-discovery.js'
import { Dialect, type DialectPlan, type LlmPlanInput } from '../types.js'
import { isOpenAiOfficial, openAiReasoningEffort } from './common.js'

interface OpenAICompatibleModel {
  id: string
  name?: string
  status?: string
  features?: unknown
  capabilities?: unknown
  max_tokens?: number
  max_context_tokens?: number
}

interface OpenAICompatibleModelsResponse {
  data?: OpenAICompatibleModel[]
}

function collectCapabilityTexts(value: unknown, output: string[] = []): string[] {
  if (typeof value === 'string') {
    output.push(value)
    return output
  }

  if (Array.isArray(value)) {
    for (const item of value) collectCapabilityTexts(item, output)
    return output
  }

  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      output.push(key)
      collectCapabilityTexts(item, output)
    }
  }

  return output
}

function parseOpenAICompatibleCapabilities(model: OpenAICompatibleModel): string[] {
  const tags = new Set<string>()
  const texts = [
    ...collectCapabilityTexts(model.features),
    ...collectCapabilityTexts(model.capabilities),
  ]

  for (const raw of texts) {
    const lower = raw?.toLowerCase()
    if (!lower) continue
    if (lower.includes('vision') || lower.includes('image')) {
      tags.add('vision')
    }
    if (
      lower.includes('reasoning') ||
      lower.includes('thinking') ||
      lower.includes('extended_thinking') ||
      lower.includes('extended-thinking')
    ) {
      tags.add('reasoning')
    }
    if (
      lower.includes('embedding') ||
      lower.includes('embeddings') ||
      lower.includes('textembedding')
    ) {
      tags.add('embedding')
    }
  }

  return [...tags]
}

export class OpenAICompatibleDialect extends Dialect {
  readonly apiFormat = 'openai-compatible' as const
  readonly aliases = ['openai-chat'] as const

  plan(input: LlmPlanInput): DialectPlan {
    return {
      providerId: isOpenAiOfficial(input.model.providerKind) ? 'openai' : 'openai-compatible',
      providerOptions: input.family.reasoning
        ? {
            openai: {
              reasoningEffort: openAiReasoningEffort(input.thinkingLevel),
            },
          }
        : undefined,
    }
  }

  async fetchModels(input: ModelDiscoveryInput): Promise<SyncModel[]> {
    const url = `${input.baseUrl.replace(/\/+$/, '')}/models`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)

    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${input.apiKey}` },
        signal: controller.signal,
      })
      if (!res.ok) return []

      const body = (await res.json()) as OpenAICompatibleModelsResponse
      return (body.data ?? [])
        .filter((model) => model.id && model.status !== 'Shutdown')
        .map((model) => ({
          modelId: model.id,
          displayName: model.name,
          maxTokens: model.max_tokens ?? model.max_context_tokens,
          capabilities: inferDefaultModelCapabilities({
            kind: input.kind,
            baseUrl: input.baseUrl,
            modelId: model.id,
            capabilities: parseOpenAICompatibleCapabilities(model),
          }),
        }))
    } catch {
      return []
    } finally {
      clearTimeout(timer)
    }
  }
}

export const openAiCompatibleDialect = new OpenAICompatibleDialect()
