import { Dialect, type DialectPlan, type LlmPlanInput } from '../types.js'
import { isOpenAiOfficial, openAiReasoningEffort } from './common.js'

export class OpenAIResponsesDialect extends Dialect {
  readonly apiFormat = 'openai-responses'

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
}

export const openAiResponsesDialect = new OpenAIResponsesDialect()
