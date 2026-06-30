import type { ModelFamilyCapabilities, ResolvedModel } from '../types.js'
import { baseCapabilities, hasCapability, lower } from './common.js'

export function matches(model: ResolvedModel): boolean {
  const kind = lower(model.providerKind)
  const id = lower(model.modelId)
  const baseUrl = lower(model.baseUrl)
  return (
    kind === 'bailian' ||
    id.includes('qwen') ||
    id.includes('qwq') ||
    id.includes('qvq') ||
    id.includes('tongyi') ||
    baseUrl.includes('maas.aliyuncs.com') ||
    baseUrl.includes('dashscope')
  )
}

export function capabilities(model: ResolvedModel): ModelFamilyCapabilities {
  const id = lower(model.modelId)
  const supportsReasoning =
    id.includes('thinking') ||
    id.includes('reasoning') ||
    id.includes('qwq') ||
    id.includes('qvq') ||
    id.includes('qwen3')
  const supportsVision =
    id.includes('vl') ||
    id.includes('vision') ||
    id.includes('omni') ||
    id.includes('qvq') ||
    id.includes('tongyi-embedding-vision')
  const reasoning = hasCapability(model, 'reasoning') && supportsReasoning

  return baseCapabilities({
    family: 'qwen',
    reasoning,
    multimodal: hasCapability(model, 'vision') && supportsVision,
    supportedThinkingLevels: reasoning ? ['off', 'low', 'medium', 'high'] : ['off'],
    defaultThinkingLevel: reasoning ? 'medium' : 'off',
    allowedApiFormats: ['openai-compatible'],
  })
}
