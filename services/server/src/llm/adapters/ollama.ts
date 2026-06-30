import type { ModelDiscoveryInput, SyncModel } from '../model-discovery.js'
import { inferDefaultModelCapabilities } from '../model-discovery.js'
import { lower } from '../families/common.js'
import { OpenAICompatibleDialect } from '../dialects/openai-compatible.js'
import type { LlmPlanInput, ProviderAdapter } from '../types.js'

interface OllamaModel {
  name: string
}

interface OllamaTagsResponse {
  models?: OllamaModel[]
}

function isOllama(input: Pick<ModelDiscoveryInput, 'kind' | 'baseUrl'>): boolean {
  const kind = lower(input.kind)
  const baseUrl = lower(input.baseUrl)
  return (
    kind === 'ollama' || baseUrl.includes('localhost:11434') || baseUrl.includes('127.0.0.1:11434')
  )
}

export class OllamaAdapter extends OpenAICompatibleDialect implements ProviderAdapter {
  readonly id = 'ollama-openai-compatible'

  matches(_input: LlmPlanInput): boolean {
    return false
  }

  matchesDiscovery(input: ModelDiscoveryInput): boolean {
    return input.apiFormat === this.apiFormat && isOllama(input)
  }

  async fetchModels(input: ModelDiscoveryInput): Promise<SyncModel[]> {
    const normalized = input.baseUrl.replace(/\/+$/, '').replace(/\/v1\/?$/, '')
    const url = `${normalized}/api/tags`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)

    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) return []

      const body = (await res.json()) as OllamaTagsResponse
      return (body.models ?? []).map((model) => ({
        modelId: model.name,
        capabilities: inferDefaultModelCapabilities({
          kind: input.kind,
          baseUrl: input.baseUrl,
          modelId: model.name,
        }),
      }))
    } catch {
      return []
    } finally {
      clearTimeout(timer)
    }
  }
}

export const ollamaAdapter = new OllamaAdapter()
