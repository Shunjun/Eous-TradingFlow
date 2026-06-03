import type { IndicatorDefinition } from '../types'
import { createSMADefinition } from './sma/definition'
import { createEMADefinition } from './ema/definition'
import { createMACDDefinition } from './macd/definition'
import { createRSIDefinition } from './rsi/definition'
import { createBollingerBandsDefinition } from './bollinger-bands/definition'

// ── Built-in Indicator Definitions ──────────────────────────────────────────

const BUILT_IN_DEFINITIONS: IndicatorDefinition[] = [
  createSMADefinition(),
  createEMADefinition(),
  createMACDDefinition(),
  createRSIDefinition(),
  createBollingerBandsDefinition(),
]

// ── Registry ────────────────────────────────────────────────────────────────

const registry = new Map<string, IndicatorDefinition>()

for (const def of BUILT_IN_DEFINITIONS) {
  registry.set(def.type, def)
}

export function getIndicatorDefinition(type: string): IndicatorDefinition | undefined {
  return registry.get(type)
}

export function getAllIndicatorDefinitions(): IndicatorDefinition[] {
  return [...registry.values()]
}

export function getIndicatorTypes(): string[] {
  return [...registry.keys()]
}

export const INDICATOR_REGISTRY: Record<string, IndicatorDefinition> = Object.fromEntries(
  BUILT_IN_DEFINITIONS.map((d) => [d.type, d]),
)

export const INDICATOR_TYPES = Object.keys(INDICATOR_REGISTRY)
