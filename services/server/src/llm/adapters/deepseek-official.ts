import type {
  DialectPlan,
  LlmPlanInput,
  ProviderAdapter,
  ProviderOptions,
  ThinkingLevel,
} from '../types.js'
import { lower } from '../families/common.js'

function isOfficialDeepSeek(input: LlmPlanInput): boolean {
  const kind = lower(input.model.providerKind)
  const baseUrl = lower(input.model.baseUrl)
  return kind === 'deepseek' || baseUrl.includes('api.deepseek.com')
}

function deepseekOptions(level: ThinkingLevel): ProviderOptions {
  if (level === 'off') {
    return { deepseek: { thinking: { type: 'disabled' } } }
  }

  return {
    deepseek: {
      thinking: { type: 'enabled' },
      reasoningEffort: level === 'max' || level === 'xhigh' ? 'max' : 'high',
    },
  }
}

export const deepseekOfficialAdapter: ProviderAdapter = {
  id: 'deepseek-official',
  matches(input: LlmPlanInput): boolean {
    return input.family.family === 'deepseek' && isOfficialDeepSeek(input)
  },
  patch(_plan: DialectPlan, input: LlmPlanInput): DialectPlan {
    return {
      providerId: input.apiFormat === 'anthropic-messages' ? 'anthropic' : 'deepseek',
      providerOptions:
        input.apiFormat === 'anthropic-messages'
          ? _plan.providerOptions
          : deepseekOptions(input.thinkingLevel),
    }
  },
}
