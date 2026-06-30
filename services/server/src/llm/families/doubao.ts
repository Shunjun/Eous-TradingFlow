import type { ModelFamilyCapabilities, ResolvedModel } from '../types.js'
import { baseCapabilities, hasCapability, lower } from './common.js'

export function matches(model: ResolvedModel): boolean {
  const kind = lower(model.providerKind)
  const id = lower(model.modelId)
  const baseUrl = lower(model.baseUrl)
  return (
    kind === 'volcengine' ||
    kind === 'ark' ||
    id.includes('doubao') ||
    id.includes('seed') ||
    baseUrl.includes('ark.cn-beijing.volces.com') ||
    baseUrl.includes('volces.com')
  )
}

export function capabilities(model: ResolvedModel): ModelFamilyCapabilities {
  const id = lower(model.modelId)
  const supportsReasoning = id.includes('thinking') || id.includes('reasoning')
  const supportsVision = id.includes('vision') || id.includes('vl') || id.includes('image')
  const reasoning = hasCapability(model, 'reasoning') && supportsReasoning

  return baseCapabilities({
    family: 'doubao',
    reasoning,
    multimodal: hasCapability(model, 'vision') && supportsVision,
    supportedThinkingLevels: reasoning ? ['off', 'low', 'medium', 'high'] : ['off'],
    defaultThinkingLevel: reasoning ? 'medium' : 'off',
    allowedApiFormats: ['openai-compatible'],
  })
}
