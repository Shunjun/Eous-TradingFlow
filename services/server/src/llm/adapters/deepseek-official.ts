import { lower } from '../families/common.js'
import { OpenAICompatibleDialect } from '../dialects/openai-compatible.js'
import type {
  DialectPlan,
  LlmPlanInput,
  ProviderAdapter,
  ProviderOptions,
  ThinkingLevel,
} from '../types.js'

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

export class DeepSeekOpenAICompatibleAdapter
  extends OpenAICompatibleDialect
  implements ProviderAdapter
{
  readonly id = 'deepseek-openai-compatible'

  matches(input: LlmPlanInput): boolean {
    return (
      input.apiFormat === this.apiFormat &&
      input.family.family === 'deepseek' &&
      isOfficialDeepSeek(input)
    )
  }

  override plan(input: LlmPlanInput): DialectPlan {
    return {
      providerId: 'deepseek',
      providerOptions: input.family.reasoning ? deepseekOptions(input.thinkingLevel) : undefined,
    }
  }
}

export const deepseekOfficialAdapter = new DeepSeekOpenAICompatibleAdapter()
