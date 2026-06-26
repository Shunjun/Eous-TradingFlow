import type { ApiFormat, Dialect } from '../types.js'
import { anthropicMessagesDialect } from './anthropic-messages.js'
import { googleGenerativeDialect } from './google-generative.js'
import { openAiChatDialect } from './openai-chat.js'
import { openAiResponsesDialect } from './openai-responses.js'

const dialects = [
  openAiChatDialect,
  openAiResponsesDialect,
  anthropicMessagesDialect,
  googleGenerativeDialect,
]

export function resolveDialect(apiFormat: ApiFormat): Dialect {
  return dialects.find((dialect) => dialect.apiFormat === apiFormat) ?? openAiChatDialect
}
