import type { Dialect, JsonValue, LlmPlanInput } from '../types.js'

function thinkingOptions(input: LlmPlanInput): Record<string, JsonValue> {
  if (input.thinkingLevel === 'off') {
    return {
      thinking: { type: 'disabled' },
      sendReasoning: false,
    }
  }

  const thinking: Record<string, JsonValue> = { type: 'enabled' }
  if (input.thinkingLevel === 'max' || input.thinkingLevel === 'xhigh') {
    thinking.budgetTokens = 64000
  }
  return { thinking }
}

export const anthropicMessagesDialect: Dialect = {
  apiFormat: 'anthropic-messages',
  plan(input: LlmPlanInput) {
    return {
      providerId: 'anthropic',
      providerOptions: input.family.reasoning
        ? {
            anthropic: thinkingOptions(input),
          }
        : undefined,
    }
  },
}
