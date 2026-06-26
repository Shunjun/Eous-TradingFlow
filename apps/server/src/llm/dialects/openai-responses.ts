import type { Dialect, LlmPlanInput } from '../types.js'
import { isOpenAiOfficial, openAiReasoningEffort } from './common.js'

export const openAiResponsesDialect: Dialect = {
  apiFormat: 'openai-responses',
  plan(input: LlmPlanInput) {
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
  },
}
