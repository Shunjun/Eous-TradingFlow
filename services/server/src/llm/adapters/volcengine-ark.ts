import type { ModelDiscoveryInput, SyncModel } from '../model-discovery.js'
import { inferDefaultModelCapabilities } from '../model-discovery.js'
import { lower } from '../families/common.js'
import { OpenAICompatibleDialect } from '../dialects/openai-compatible.js'
import type { LlmPlanInput, ProviderAdapter } from '../types.js'

interface VolcengineArkModel {
  id: string
  name?: string
  status?: string
  domain?: string
  features?: unknown
  capabilities?: unknown
  modalities?: {
    input_modalities?: unknown
    output_modalities?: unknown
  }
  task_type?: unknown
  token_limits?: {
    context_window?: number
    max_input_token_length?: number
    max_output_token_length?: number
    max_reasoning_token_length?: number
  }
  max_tokens?: number
  max_context_tokens?: number
}

interface VolcengineArkModelsResponse {
  data?: VolcengineArkModel[]
}

function isVolcengineArk(input: Pick<ModelDiscoveryInput, 'kind' | 'baseUrl'>): boolean {
  const kind = lower(input.kind)
  const baseUrl = lower(input.baseUrl)
  return kind === 'volcengine' || kind === 'ark' || baseUrl.includes('volces.com')
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

function parseVolcengineCapabilities(model: VolcengineArkModel): string[] {
  const tags = new Set<string>()
  const texts = [
    model.domain,
    ...collectCapabilityTexts(model.features),
    ...collectCapabilityTexts(model.capabilities),
    ...collectCapabilityTexts(model.modalities),
    ...collectCapabilityTexts(model.task_type),
  ]

  for (const raw of texts) {
    const value = raw?.toLowerCase()
    if (!value) continue
    if (
      value === 'vlm' ||
      value.includes('vision') ||
      value.includes('visual') ||
      value.includes('image')
    ) {
      tags.add('vision')
    }
    if (value.includes('reasoning') || value.includes('thinking')) {
      tags.add('reasoning')
    }
    if (
      value.includes('embedding') ||
      value.includes('embeddings') ||
      value.includes('textembedding') ||
      value.includes('imageembedding')
    ) {
      tags.add('embedding')
    }
  }

  if (model.token_limits?.max_reasoning_token_length) tags.add('reasoning')

  return [...tags]
}

export class VolcengineArkAdapter extends OpenAICompatibleDialect implements ProviderAdapter {
  readonly id = 'volcengine-ark-openai-compatible'

  matches(_input: LlmPlanInput): boolean {
    return false
  }

  matchesDiscovery(input: ModelDiscoveryInput): boolean {
    return input.apiFormat === this.apiFormat && isVolcengineArk(input)
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

      const body = (await res.json()) as VolcengineArkModelsResponse
      return (body.data ?? [])
        .filter((model) => model.id && model.status !== 'Shutdown')
        .map((model) => ({
          modelId: model.id,
          displayName: model.name,
          maxTokens:
            model.max_tokens ??
            model.token_limits?.max_output_token_length ??
            model.max_context_tokens ??
            model.token_limits?.context_window,
          capabilities: inferDefaultModelCapabilities({
            kind: input.kind,
            baseUrl: input.baseUrl,
            modelId: model.id,
            capabilities: parseVolcengineCapabilities(model),
          }),
        }))
    } catch {
      return []
    } finally {
      clearTimeout(timer)
    }
  }
}

export const volcengineArkAdapter = new VolcengineArkAdapter()
