import type { DialectPlan, LlmPlanInput, ProviderAdapter } from '../types.js'
import { deepseekOfficialAdapter } from './deepseek-official.js'

const adapters: ProviderAdapter[] = [deepseekOfficialAdapter]

export function applyProviderAdapter(
  plan: DialectPlan,
  input: LlmPlanInput,
): DialectPlan & { adapter?: string } {
  const adapter = adapters.find((item) => item.matches(input))
  if (!adapter) return plan

  return {
    ...adapter.patch(plan, input),
    adapter: adapter.id,
  }
}
