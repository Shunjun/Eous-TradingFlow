import type { ModelFamilyCapabilities, ResolvedModel } from '../types.js'
import { baseCapabilities, hasCapability, lower } from './common.js'

export function matches(model: ResolvedModel): boolean {
  const kind = lower(model.providerKind)
  const id = lower(model.modelId)
  return kind === 'anthropic' || id.includes('claude')
}

export function capabilities(model: ResolvedModel): ModelFamilyCapabilities {
  const id = lower(model.modelId)
  const reasoning =
    hasCapability(model, 'reasoning') || id.includes('sonnet-4') || id.includes('opus-4')

  return baseCapabilities({
    family: 'anthropic',
    reasoning,
    multimodal:
      hasCapability(model, 'vision') || id.includes('claude-3') || id.includes('claude-4'),
    supportedThinkingLevels: reasoning ? ['off', 'low', 'medium', 'high', 'max'] : ['off'],
    defaultThinkingLevel: reasoning ? 'medium' : 'off',
    allowedApiFormats: ['anthropic-messages'],
  })
}
