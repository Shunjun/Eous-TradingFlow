import type { CustomOutputDef, NodeDef, OutputDef } from '@eous/nodes'

const OUTPUT_TYPES = ['string', 'number', 'boolean', 'object', 'array', 'file'] as const

function normalizeOutputType(type: string): OutputDef['type'] {
  if (
    type === 'number' ||
    type === 'boolean' ||
    type === 'object' ||
    type === 'array' ||
    type === 'file'
  ) {
    return type
  }
  if (type.endsWith('[]') || type.toLowerCase().includes('array')) return 'array'
  if (type === 'json') return 'object'
  return 'string'
}

function getBaseOutputs(def: NodeDef | undefined): OutputDef[] {
  if (!def) return []
  return Object.values(def.executeOutput).map((field) => ({
    name: field.name,
    type: normalizeOutputType(field.type),
    source: field.source,
    description: field.description,
  }))
}

function getCustomOutputs(data: Record<string, unknown>): CustomOutputDef[] {
  if (!Array.isArray(data.customOutputs)) return []
  return data.customOutputs.filter((item): item is CustomOutputDef => {
    if (!item || typeof item !== 'object') return false
    const output = item as Record<string, unknown>
    return typeof output.name === 'string' && typeof output.expression === 'string'
  })
}

function getEffectiveOutputs(data: Record<string, unknown>, def: NodeDef | undefined): OutputDef[] {
  return [
    ...getBaseOutputs(def),
    ...getCustomOutputs(data).map((output) => ({
      name: output.name,
      type: output.type,
      description: output.description,
      source: { field: output.name },
    })),
  ]
}

export { getBaseOutputs, getCustomOutputs, getEffectiveOutputs, normalizeOutputType, OUTPUT_TYPES }
