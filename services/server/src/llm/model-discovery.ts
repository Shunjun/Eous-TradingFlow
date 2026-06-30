export interface SyncModel {
  modelId: string
  displayName?: string
  maxTokens?: number
  capabilities: string[]
}

export interface ModelDiscoveryInput {
  kind: string
  baseUrl: string
  apiKey: string
  apiFormat: string
}

export function inferDefaultModelCapabilities(params: {
  kind: string
  baseUrl?: string
  modelId: string
  capabilities?: string[]
}): string[] {
  const { kind, baseUrl = '', modelId, capabilities = [] } = params
  const tags = new Set(capabilities)
  const lower = modelId.toLowerCase()
  const lowerKind = kind.toLowerCase()
  const lowerBaseUrl = baseUrl.toLowerCase()

  const isOpenAI = lowerKind === 'openai'
  const isDeepSeek =
    lowerKind === 'deepseek' ||
    lowerBaseUrl.includes('api.deepseek.com') ||
    lower.includes('deepseek')
  const isAnthropic = lowerKind === 'anthropic' || lower.includes('claude')
  const isGoogle = lowerKind === 'google' || lower.includes('gemini')
  const isQwen =
    lowerKind === 'bailian' ||
    lower.includes('qwen') ||
    lower.includes('qwq') ||
    lower.includes('qvq') ||
    lower.includes('tongyi') ||
    lowerBaseUrl.includes('maas.aliyuncs.com') ||
    lowerBaseUrl.includes('dashscope')
  const isDoubao =
    lowerKind === 'volcengine' ||
    lowerKind === 'ark' ||
    lower.includes('doubao') ||
    lower.includes('seed') ||
    lowerBaseUrl.includes('ark.cn-beijing.volces.com') ||
    lowerBaseUrl.includes('volces.com')
  const isKimi =
    lowerKind === 'kimi' ||
    lowerKind === 'moonshot' ||
    lower.includes('kimi') ||
    lowerBaseUrl.includes('moonshot')
  const isGlm =
    lowerKind === 'glm' ||
    lowerKind === 'zhipu' ||
    lower.includes('glm') ||
    lowerBaseUrl.includes('bigmodel')
  const isMimo =
    lowerKind === 'mimo' || lower.includes('mimo') || lowerBaseUrl.includes('xiaomimimo')

  if (
    (isOpenAI && (/^o\d/.test(lower) || lower.startsWith('gpt-5'))) ||
    (isDeepSeek && (lower.includes('reasoner') || lower.includes('r1') || lower.includes('v4'))) ||
    (isAnthropic && (lower.includes('sonnet-4') || lower.includes('opus-4'))) ||
    (isGoogle && lower.includes('thinking')) ||
    (isQwen &&
      (lower.includes('thinking') ||
        lower.includes('reasoning') ||
        lower.includes('qwq') ||
        lower.includes('qvq') ||
        lower.includes('qwen3'))) ||
    (isDoubao && (lower.includes('thinking') || lower.includes('reasoning'))) ||
    (isKimi && (lower.includes('thinking') || lower.includes('k2'))) ||
    (isGlm && (lower.includes('z1') || lower.includes('thinking'))) ||
    (isMimo && lower.includes('mimo-v'))
  ) {
    tags.add('reasoning')
  }

  if (
    (isOpenAI && (lower.includes('4o') || lower.includes('gpt-5'))) ||
    (isAnthropic && (lower.includes('claude-3') || lower.includes('claude-4'))) ||
    (isGoogle && lower.includes('gemini')) ||
    (isQwen &&
      (lower.includes('vl') ||
        lower.includes('vision') ||
        lower.includes('omni') ||
        lower.includes('qvq') ||
        lower.includes('tongyi-embedding-vision'))) ||
    (isDoubao && (lower.includes('vision') || lower.includes('vl') || lower.includes('image'))) ||
    (isGlm && lower.includes('glm-4v'))
  ) {
    tags.add('vision')
  }

  if (
    lower.includes('embedding') ||
    lower.includes('embed') ||
    lower.includes('bge') ||
    lower.includes('e5-') ||
    lower.includes('text-embedding') ||
    lower.includes('multilingual-e5') ||
    lower.includes('tongyi-embedding')
  ) {
    tags.add('embedding')
  }

  return [...tags]
}
