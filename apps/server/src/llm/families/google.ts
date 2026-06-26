import type { ModelFamilyCapabilities, ResolvedModel } from '../types.js'
import { baseCapabilities, hasCapability, lower } from './common.js'

export function matches(model: ResolvedModel): boolean {
  const kind = lower(model.providerKind)
  const id = lower(model.modelId)
  return kind === 'google' || id.includes('gemini')
}

export function capabilities(model: ResolvedModel): ModelFamilyCapabilities {
  const id = lower(model.modelId)
  const reasoning = hasCapability(model, 'reasoning') || id.includes('thinking')

  return baseCapabilities({
    family: 'google',
    reasoning,
    multimodal: true,
    supportedThinkingLevels: reasoning ? ['off', 'low', 'medium', 'high'] : ['off'],
    defaultThinkingLevel: reasoning ? 'medium' : 'off',
    allowedApiFormats: ['google-generative', 'openai-chat'],
  })
}
