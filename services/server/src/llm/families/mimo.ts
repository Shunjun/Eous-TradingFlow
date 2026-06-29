import type { ModelFamilyCapabilities, ResolvedModel } from '../types.js'
import { baseCapabilities, hasCapability, lower } from './common.js'

export function matches(model: ResolvedModel): boolean {
  const kind = lower(model.providerKind)
  const id = lower(model.modelId)
  const baseUrl = lower(model.baseUrl)
  return kind === 'mimo' || id.includes('mimo') || baseUrl.includes('xiaomimimo')
}

export function capabilities(model: ResolvedModel): ModelFamilyCapabilities {
  const reasoning = hasCapability(model, 'reasoning') || lower(model.modelId).includes('mimo-v')

  return baseCapabilities({
    family: 'mimo',
    reasoning,
    multimodal: hasCapability(model, 'vision'),
    supportedThinkingLevels: reasoning ? ['off', 'low', 'medium', 'high'] : ['off'],
    defaultThinkingLevel: reasoning ? 'medium' : 'off',
    allowedApiFormats: ['openai-chat'],
  })
}
