import type { VariableRef } from './variable-picker'

const VAR_PATTERN = /^{{(.+)}}$/

function isVariableRef(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = value.match(VAR_PATTERN)
  return Boolean(match?.[1].startsWith('node:'))
}

function parseVariableRef(value: string): VariableRef | null {
  const match = value.match(VAR_PATTERN)
  if (!match) return null

  const path = match[1]
  if (!path.startsWith('node:')) return null
  const rest = path.slice('node:'.length)
  const separatorIndex = rest.indexOf(':')
  if (separatorIndex === -1) return null
  const nodeId = rest.slice(0, separatorIndex)
  const fieldName = rest.slice(separatorIndex + 1)
  if (!nodeId || !fieldName) return null
  return {
    nodeLabel: nodeId,
    fieldName,
    nodeId,
    fieldType: '',
  }
}

function formatVariableRef(ref: VariableRef) {
  if (!ref.nodeId) throw new Error('Variable ref must include nodeId')
  return `{{node:${ref.nodeId}:${ref.fieldName}}}`
}

function displayVariableRef(value: string) {
  const parsed = parseVariableRef(value)
  if (!parsed) return value.replace(VAR_PATTERN, '$1')
  return `${parsed.nodeLabel}.${parsed.fieldName}`
}

export { VAR_PATTERN, displayVariableRef, formatVariableRef, isVariableRef, parseVariableRef }
