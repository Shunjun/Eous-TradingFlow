import type { NodeDef, OutputDef } from '@eous/nodes'

const OUTPUT_TYPES = ['string', 'number', 'boolean', 'json', 'array', 'file'] as const

function getEffectiveOutputs(data: Record<string, unknown>, def: NodeDef | undefined): OutputDef[] {
  if (Array.isArray(data.outputs)) return data.outputs as OutputDef[]
  if (!def) return []
  return Object.values(def.executeOutput).map((field) => ({
    name: field.name,
    type: field.type as OutputDef['type'],
    source: field.source,
  }))
}

function ensureOutputsInData(
  data: Record<string, unknown>,
  def: NodeDef | undefined,
  onChange: (data: Record<string, unknown>) => void,
): OutputDef[] {
  if (Array.isArray(data.outputs)) return data.outputs as OutputDef[]
  const fallback = getEffectiveOutputs(data, def)
  onChange({ ...data, outputs: fallback })
  return fallback
}

export { ensureOutputsInData, getEffectiveOutputs, OUTPUT_TYPES }
