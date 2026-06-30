import type { ModelDiscoveryInput, SyncModel } from '../model-discovery.js'
import { inferDefaultModelCapabilities } from '../model-discovery.js'
import { Dialect, type DialectPlan, type LlmPlanInput } from '../types.js'

interface GoogleModel {
  name: string
  displayName?: string
  inputTokenLimit?: number
  outputTokenLimit?: number
  supportedGenerationMethods?: string[]
}

interface GoogleModelsResponse {
  models?: GoogleModel[]
}

function thinkingBudget(input: LlmPlanInput): number {
  if (input.thinkingLevel === 'off') return 0
  if (input.thinkingLevel === 'low') return 1024
  if (
    input.thinkingLevel === 'high' ||
    input.thinkingLevel === 'max' ||
    input.thinkingLevel === 'xhigh'
  ) {
    return 8192
  }
  return 4096
}

export class GoogleGenerativeDialect extends Dialect {
  readonly apiFormat = 'google-generative'

  plan(input: LlmPlanInput): DialectPlan {
    return {
      providerId: 'google',
      providerOptions: input.family.reasoning
        ? {
            google: {
              thinkingConfig: { thinkingBudget: thinkingBudget(input) },
            },
          }
        : undefined,
    }
  }

  async fetchModels(input: ModelDiscoveryInput): Promise<SyncModel[]> {
    const base = input.baseUrl.replace(/\/+$/, '')
    const url = `${base}/models?key=${encodeURIComponent(input.apiKey)}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)

    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) return []

      const body = (await res.json()) as GoogleModelsResponse
      return (body.models ?? [])
        .filter((model) => model.supportedGenerationMethods?.includes('generateContent') ?? true)
        .map((model) => {
          const modelId = model.name.replace(/^models\//, '')
          const caps = new Set<string>()
          if (modelId.toLowerCase().includes('gemini')) caps.add('vision')
          if (modelId.toLowerCase().includes('thinking')) caps.add('reasoning')
          return {
            modelId,
            displayName: model.displayName,
            maxTokens: model.outputTokenLimit,
            capabilities: inferDefaultModelCapabilities({
              kind: input.kind,
              baseUrl: input.baseUrl,
              modelId,
              capabilities: [...caps],
            }),
          }
        })
    } catch {
      return []
    } finally {
      clearTimeout(timer)
    }
  }
}

export const googleGenerativeDialect = new GoogleGenerativeDialect()
