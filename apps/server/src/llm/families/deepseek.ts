import type { ModelFamilyCapabilities, ResolvedModel } from '../types.js'
import { baseCapabilities, hasCapability, lower } from './common.js'

export function matches(model: ResolvedModel): boolean {
  const kind = lower(model.providerKind)
  const id = lower(model.modelId)
  const baseUrl = lower(model.baseUrl)
  return kind === 'deepseek' || baseUrl.includes('api.deepseek.com') || id.includes('deepseek')
}

export function capabilities(model: ResolvedModel): ModelFamilyCapabilities {
  const id = lower(model.modelId)
  const reasoning =
    hasCapability(model, 'reasoning') ||
    id.includes('reasoner') ||
    id.includes('r1') ||
    id.includes('v4')

  return baseCapabilities({
    family: 'deepseek',
    reasoning,
    multimodal: hasCapability(model, 'vision'),
    supportedThinkingLevels: reasoning ? ['off', 'high', 'max'] : ['off'],
    defaultThinkingLevel: reasoning ? 'high' : 'off',
    allowedApiFormats: ['openai-chat', 'anthropic-messages'],
  })
}
