import type { SyncModel } from '../llm/model-discovery.js'
import { resolveProviderDiscoveryDialect } from '../llm/adapters/index.js'
import { normalizeApiFormat, resolveDialect } from '../llm/dialects/index.js'

export type { SyncModel } from '../llm/model-discovery.js'
export { inferDefaultModelCapabilities } from '../llm/model-discovery.js'

/**
 * Fetch available models from a provider's API.
 * Returns an empty array on any failure (network, timeout, non-2xx).
 */
export async function fetchModelsFromProvider(
  kind: string,
  baseUrl: string,
  apiKey: string,
  apiFormat = 'openai-compatible',
): Promise<SyncModel[]> {
  try {
    const normalizedApiFormat = normalizeApiFormat(apiFormat)
    const dialect = resolveProviderDiscoveryDialect(
      { kind, baseUrl, apiKey, apiFormat: normalizedApiFormat },
      resolveDialect(normalizedApiFormat),
    )
    return await dialect.fetchModels({ kind, baseUrl, apiKey, apiFormat: normalizedApiFormat })
  } catch {
    return []
  }
}
