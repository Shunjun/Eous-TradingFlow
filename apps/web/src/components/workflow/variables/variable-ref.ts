import type { VariableRef } from './variable-picker'

const VAR_PATTERN = /^{{node:([^:}]+):([^}]+)}}$/
const EMBEDDED_VAR_PATTERN = /{{node:([^:}]+):([^}]+)}}/g

function isVariableRef(value: unknown): value is string {
  if (typeof value !== 'string') return false
  return VAR_PATTERN.test(value)
}

function parseVariableRef(value: string): VariableRef | null {
  const match = value.match(VAR_PATTERN)
  if (!match) return null

  const nodeId = match[1]
  const fieldName = match[2]
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
  if (!parsed) return value
  return `${parsed.nodeLabel}.${parsed.fieldName}`
}

export {
  EMBEDDED_VAR_PATTERN,
  VAR_PATTERN,
  displayVariableRef,
  formatVariableRef,
  isVariableRef,
  parseVariableRef,
}
