import type { ModelDiscoveryInput } from '../model-discovery.js'
import type { Dialect, LlmPlanInput, ProviderAdapter } from '../types.js'
import { deepseekOfficialAdapter } from './deepseek-official.js'
import { ollamaAdapter } from './ollama.js'
import { volcengineArkAdapter } from './volcengine-ark.js'

const adapters: ProviderAdapter[] = [deepseekOfficialAdapter, volcengineArkAdapter, ollamaAdapter]

export function resolveProviderAdapter(input: LlmPlanInput): ProviderAdapter | null {
  const adapter = adapters.find((item) => item.matches(input))
  return adapter ?? null
}

export function resolveProviderDialect(input: LlmPlanInput, dialect: Dialect): Dialect {
  return resolveProviderAdapter(input) ?? dialect
}

export function resolveProviderDiscoveryDialect(
  input: ModelDiscoveryInput,
  dialect: Dialect,
): Dialect {
  const adapter = adapters.find((item) => item.matchesDiscovery?.(input))
  return adapter ?? dialect
}
