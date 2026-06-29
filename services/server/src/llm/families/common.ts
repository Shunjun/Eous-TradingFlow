import type { ApiFormat, ModelFamilyCapabilities, ResolvedModel, ThinkingLevel } from '../types.js'

export function lower(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : ''
}

export function hasCapability(model: ResolvedModel, capability: string): boolean {
  return (model.capabilities ?? []).some((item) => lower(item) === capability)
}

export function clampThinkingLevel(
  requested: ThinkingLevel | undefined,
  supported: ThinkingLevel[],
  fallback: ThinkingLevel,
): ThinkingLevel {
  const level = requested ?? fallback
  if (supported.includes(level)) return level
  if (level === 'max' || level === 'xhigh') {
    if (supported.includes('high')) return 'high'
    if (supported.includes('medium')) return 'medium'
  }
  if (level === 'medium') {
    if (supported.includes('high')) return 'high'
    if (supported.includes('low')) return 'low'
  }
  if (level === 'high') {
    if (supported.includes('medium')) return 'medium'
    if (supported.includes('low')) return 'low'
  }
  if (level === 'low' && supported.includes('medium')) return 'medium'
  return supported[0] ?? 'off'
}

export function baseCapabilities(params: {
  family: string
  reasoning?: boolean
  multimodal?: boolean
  supportedThinkingLevels?: ThinkingLevel[]
  defaultThinkingLevel?: ThinkingLevel
  allowedApiFormats?: ApiFormat[]
}): ModelFamilyCapabilities {
  return {
    family: params.family,
    reasoning: params.reasoning ?? false,
    multimodal: params.multimodal ?? false,
    supportedThinkingLevels: params.supportedThinkingLevels ?? ['off'],
    defaultThinkingLevel: params.defaultThinkingLevel ?? 'off',
    allowedApiFormats: params.allowedApiFormats ?? ['openai-chat'],
  }
}
