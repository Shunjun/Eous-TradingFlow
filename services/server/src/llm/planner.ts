import { clampThinkingLevel } from './families/common.js'
import { resolveModelFamily } from './families/index.js'
import { applyProviderAdapter } from './adapters/index.js'
import { resolveDialect } from './dialects/index.js'
import type { ApiFormat, LlmPlan, ResolvedModel, ThinkingLevel } from './types.js'

function normalizeApiFormat(value: string): ApiFormat {
  if (
    value === 'openai-chat' ||
    value === 'openai-responses' ||
    value === 'anthropic-messages' ||
    value === 'google-generative'
  ) {
    return value
  }
  return 'openai-chat'
}

export function planLlmRequest(
  model: ResolvedModel,
  options: { thinkingLevel?: ThinkingLevel } = {},
): LlmPlan {
  const family = resolveModelFamily(model)
  const apiFormat = normalizeApiFormat(model.apiFormat)
  const thinkingLevel = family.reasoning
    ? clampThinkingLevel(
        options.thinkingLevel,
        family.supportedThinkingLevels,
        family.defaultThinkingLevel,
      )
    : 'off'

  const input = { model, family, apiFormat, thinkingLevel }
  const dialectPlan = resolveDialect(apiFormat).plan(input)
  const providerPlan = applyProviderAdapter(dialectPlan, input)

  return {
    family: family.family,
    apiFormat,
    providerId: providerPlan.providerId,
    adapter: providerPlan.adapter,
    thinkingLevel,
    providerOptions: providerPlan.providerOptions,
  }
}
