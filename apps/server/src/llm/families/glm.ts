import type { ModelFamilyCapabilities, ResolvedModel } from '../types.js'
import { baseCapabilities, hasCapability, lower } from './common.js'

export function matches(model: ResolvedModel): boolean {
  const kind = lower(model.providerKind)
  const id = lower(model.modelId)
  const baseUrl = lower(model.baseUrl)
  return kind === 'glm' || kind === 'zhipu' || id.includes('glm') || baseUrl.includes('bigmodel')
}

export function capabilities(model: ResolvedModel): ModelFamilyCapabilities {
  const id = lower(model.modelId)
  const reasoning =
    hasCapability(model, 'reasoning') || id.includes('z1') || id.includes('thinking')

  return baseCapabilities({
    family: 'glm',
    reasoning,
    multimodal: hasCapability(model, 'vision') || id.includes('glm-4v'),
    supportedThinkingLevels: reasoning ? ['off', 'low', 'medium', 'high'] : ['off'],
    defaultThinkingLevel: reasoning ? 'medium' : 'off',
    allowedApiFormats: ['openai-chat'],
  })
}
