import type { ModelFamilyCapabilities, ResolvedModel } from '../types.js'
import { baseCapabilities, hasCapability, lower } from './common.js'

export function matches(model: ResolvedModel): boolean {
  return lower(model.providerKind) === 'openai'
}

export function capabilities(model: ResolvedModel): ModelFamilyCapabilities {
  const id = lower(model.modelId)
  const supportsReasoning = /^o\d/.test(id) || id.startsWith('gpt-5')
  const supportsVision = id.includes('4o') || id.includes('gpt-5')
  const reasoning = hasCapability(model, 'reasoning') && supportsReasoning

  return baseCapabilities({
    family: 'openai',
    reasoning,
    multimodal: hasCapability(model, 'vision') && supportsVision,
    supportedThinkingLevels: reasoning ? ['off', 'low', 'medium', 'high', 'max'] : ['off'],
    defaultThinkingLevel: reasoning ? 'medium' : 'off',
    allowedApiFormats: ['openai-compatible', 'openai-responses'],
  })
}
