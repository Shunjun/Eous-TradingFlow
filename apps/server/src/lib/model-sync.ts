export interface SyncModel {
  modelId: string
  displayName?: string
  maxTokens?: number
  capabilities: string[]
}

const TIMEOUT_MS = 10_000

// ── OpenAI / DeepSeek / Custom (OpenAI-compatible) ──────────────────────────

interface OpenAIModel {
  id: string
  features?: string[]
  capabilities?: string[]
  max_tokens?: number
  max_context_tokens?: number
}

interface OpenAIModelsResponse {
  data: OpenAIModel[]
}

function parseCapabilities(features?: string[], capabilities?: string[]): string[] {
  const tags = new Set<string>()
  const src = features ?? capabilities ?? []
  for (const f of src) {
    const lower = f.toLowerCase()
    if (lower.includes('vision')) tags.add('vision')
    if (lower.includes('function_calling') || lower.includes('function-calling')) tags.add('function_calling')
    if (lower.includes('reasoning') || lower.includes('extended_thinking') || lower.includes('extended-thinking')) tags.add('reasoning')
  }
  return [...tags]
}

async function fetchOpenAICompatible(
  baseUrl: string,
  apiKey: string,
): Promise<SyncModel[]> {
  const url = `${baseUrl.replace(/\/+$/, '')}/models`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    })
    if (!res.ok) return []

    const body = (await res.json()) as OpenAIModelsResponse
    return (body.data ?? []).map((m) => ({
      modelId: m.id,
      maxTokens: m.max_tokens ?? m.max_context_tokens,
      capabilities: parseCapabilities(m.features, m.capabilities),
    }))
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

// ── Anthropic ───────────────────────────────────────────────────────────────

interface AnthropicModel {
  id: string
  display_name?: string
  max_tokens?: number
}

interface AnthropicModelsResponse {
  data: AnthropicModel[]
}

async function fetchAnthropic(
  baseUrl: string,
  apiKey: string,
): Promise<SyncModel[]> {
  const url = `${baseUrl.replace(/\/+$/, '')}/models`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `x-api-key ${apiKey}`,
        'anthropic-version': '2023-06-01',
      },
      signal: controller.signal,
    })
    if (!res.ok) return []

    const body = (await res.json()) as AnthropicModelsResponse
    return (body.data ?? []).map((m) => ({
      modelId: m.id,
      displayName: m.display_name,
      maxTokens: m.max_tokens,
      capabilities: [],
    }))
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

// ── Ollama ──────────────────────────────────────────────────────────────────

interface OllamaModel {
  name: string
  details?: {
    parameter_size?: string
    family?: string
  }
}

interface OllamaTagsResponse {
  models: OllamaModel[]
}

async function fetchOllama(baseUrl: string): Promise<SyncModel[]> {
  // Strip trailing /v1 if present, then use /api/tags
  const normalized = baseUrl.replace(/\/+$/, '').replace(/\/v1\/?$/, '')
  const url = `${normalized}/api/tags`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return []

    const body = (await res.json()) as OllamaTagsResponse
    return (body.models ?? []).map((m) => ({
      modelId: m.name,
      capabilities: [],
    }))
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch available models from a provider's API.
 * Returns an empty array on any failure (network, timeout, non-2xx).
 */
export async function fetchModelsFromProvider(
  kind: string,
  baseUrl: string,
  apiKey: string,
): Promise<SyncModel[]> {
  try {
    switch (kind) {
      case 'ollama':
        return await fetchOllama(baseUrl)
      case 'anthropic':
        return await fetchAnthropic(baseUrl, apiKey)
      case 'openai':
      case 'deepseek':
      case 'custom':
      default:
        return await fetchOpenAICompatible(baseUrl, apiKey)
    }
  } catch {
    return []
  }
}
