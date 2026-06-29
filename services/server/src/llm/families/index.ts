import type { ModelFamilyCapabilities, ResolvedModel } from '../types.js'
import { baseCapabilities } from './common.js'
import * as anthropic from './anthropic.js'
import * as deepseek from './deepseek.js'
import * as glm from './glm.js'
import * as google from './google.js'
import * as kimi from './kimi.js'
import * as mimo from './mimo.js'
import * as openai from './openai.js'

const families = [deepseek, kimi, mimo, glm, google, anthropic, openai]

export function resolveModelFamily(model: ResolvedModel): ModelFamilyCapabilities {
  const family = families.find((item) => item.matches(model))
  if (family) return family.capabilities(model)

  return baseCapabilities({
    family: model.providerKind || 'custom',
    reasoning: (model.capabilities ?? []).includes('reasoning'),
    multimodal: (model.capabilities ?? []).includes('vision'),
    supportedThinkingLevels: (model.capabilities ?? []).includes('reasoning')
      ? ['off', 'low', 'medium', 'high']
      : ['off'],
    defaultThinkingLevel: (model.capabilities ?? []).includes('reasoning') ? 'medium' : 'off',
    allowedApiFormats: [
      'openai-chat',
      'openai-responses',
      'anthropic-messages',
      'google-generative',
    ],
  })
}
