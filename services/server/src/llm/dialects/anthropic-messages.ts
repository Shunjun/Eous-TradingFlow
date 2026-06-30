import type { ModelDiscoveryInput, SyncModel } from '../model-discovery.js'
import { inferDefaultModelCapabilities } from '../model-discovery.js'
import { Dialect, type DialectPlan, type JsonValue, type LlmPlanInput } from '../types.js'

interface AnthropicModel {
  id: string
  display_name?: string
  max_tokens?: number
}

interface AnthropicModelsResponse {
  data?: AnthropicModel[]
}

function thinkingOptions(input: LlmPlanInput): Record<string, JsonValue> {
  if (input.thinkingLevel === 'off') {
    return {
      thinking: { type: 'disabled' },
      sendReasoning: false,
    }
  }

  const thinking: Record<string, JsonValue> = { type: 'enabled' }
  if (input.thinkingLevel === 'max' || input.thinkingLevel === 'xhigh') {
    thinking.budgetTokens = 64000
  }
  return { thinking }
}

export class AnthropicMessagesDialect extends Dialect {
  readonly apiFormat = 'anthropic-messages'

  plan(input: LlmPlanInput): DialectPlan {
    return {
      providerId: 'anthropic',
      providerOptions: input.family.reasoning
        ? {
            anthropic: thinkingOptions(input),
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
        headers: {
          Authorization: `x-api-key ${input.apiKey}`,
          'anthropic-version': '2023-06-01',
        },
        signal: controller.signal,
      })
      if (!res.ok) return []

      const body = (await res.json()) as AnthropicModelsResponse
      return (body.data ?? []).map((model) => ({
        modelId: model.id,
        displayName: model.display_name,
        maxTokens: model.max_tokens,
        capabilities: inferDefaultModelCapabilities({
          kind: input.kind,
          baseUrl: input.baseUrl,
          modelId: model.id,
        }),
      }))
    } catch {
      return []
    } finally {
      clearTimeout(timer)
    }
  }
}

export const anthropicMessagesDialect = new AnthropicMessagesDialect()
