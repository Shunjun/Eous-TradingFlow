import type { ApiFormat, Dialect } from '../types.js'
import { anthropicMessagesDialect } from './anthropic-messages.js'
import { googleGenerativeDialect } from './google-generative.js'
import { openAiCompatibleDialect } from './openai-compatible.js'
import { openAiResponsesDialect } from './openai-responses.js'

const dialects = [
  openAiCompatibleDialect,
  openAiResponsesDialect,
  anthropicMessagesDialect,
  googleGenerativeDialect,
]

export function normalizeApiFormat(value: string): ApiFormat {
  if (value === 'openai-compatible' || value === 'openai-chat') return 'openai-compatible'
  if (
    value === 'openai-responses' ||
    value === 'anthropic-messages' ||
    value === 'google-generative'
  ) {
    return value
  }
  return 'openai-compatible'
}

export function resolveDialect(apiFormat: ApiFormat): Dialect {
  return dialects.find((dialect) => dialect.matchesApiFormat(apiFormat)) ?? openAiCompatibleDialect
}
