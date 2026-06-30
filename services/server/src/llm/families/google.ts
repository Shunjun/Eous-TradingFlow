import type { ModelFamilyCapabilities, ResolvedModel } from '../types.js'
import { baseCapabilities, hasCapability, lower } from './common.js'

export function matches(model: ResolvedModel): boolean {
  const kind = lower(model.providerKind)
  const id = lower(model.modelId)
  return kind === 'google' || id.includes('gemini')
}

export function capabilities(model: ResolvedModel): ModelFamilyCapabilities {
  const id = lower(model.modelId)
  const supportsReasoning = id.includes('thinking')
  const supportsVision = id.includes('gemini')
  const reasoning = hasCapability(model, 'reasoning') && supportsReasoning

  return baseCapabilities({
    family: 'google',
    reasoning,
    multimodal: hasCapability(model, 'vision') && supportsVision,
    supportedThinkingLevels: reasoning ? ['off', 'low', 'medium', 'high'] : ['off'],
    defaultThinkingLevel: reasoning ? 'medium' : 'off',
    allowedApiFormats: ['google-generative', 'openai-compatible'],
  })
}
