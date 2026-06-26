import type { Dialect, LlmPlanInput } from '../types.js'

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

export const googleGenerativeDialect: Dialect = {
  apiFormat: 'google-generative',
  plan(input: LlmPlanInput) {
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
  },
}
