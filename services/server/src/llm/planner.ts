import { clampThinkingLevel } from './families/common.js'
import { resolveModelFamily } from './families/index.js'
import { resolveProviderAdapter, resolveProviderDialect } from './adapters/index.js'
import { normalizeApiFormat, resolveDialect } from './dialects/index.js'
import type { LlmPlan, ResolvedModel, ThinkingLevel } from './types.js'

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
  const dialect = resolveProviderDialect(input, resolveDialect(apiFormat))
  const providerPlan = dialect.plan(input)
  const adapter = resolveProviderAdapter(input)

  return {
    family: family.family,
    apiFormat,
    providerId: providerPlan.providerId,
    adapter: adapter?.id,
    thinkingLevel,
    providerOptions: providerPlan.providerOptions,
  }
}
