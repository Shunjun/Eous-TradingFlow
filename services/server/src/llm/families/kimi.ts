import type { ModelFamilyCapabilities, ResolvedModel } from '../types.js'
import { baseCapabilities, hasCapability, lower } from './common.js'

export function matches(model: ResolvedModel): boolean {
  const kind = lower(model.providerKind)
  const id = lower(model.modelId)
  const baseUrl = lower(model.baseUrl)
  return (
    kind === 'kimi' || kind === 'moonshot' || id.includes('kimi') || baseUrl.includes('moonshot')
  )
}

export function capabilities(model: ResolvedModel): ModelFamilyCapabilities {
  const id = lower(model.modelId)
  const supportsReasoning = id.includes('thinking') || id.includes('k2')
  const reasoning = hasCapability(model, 'reasoning') && supportsReasoning

  return baseCapabilities({
    family: 'kimi',
    reasoning,
    multimodal: hasCapability(model, 'vision'),
    supportedThinkingLevels: reasoning ? ['off', 'low', 'medium', 'high'] : ['off'],
    defaultThinkingLevel: reasoning ? 'medium' : 'off',
    allowedApiFormats: ['openai-compatible'],
  })
}
