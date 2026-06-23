import type { VariableRef } from '../../variables'

const VAR_PATTERN = /^{{(.+)}}$/

function isVariableRef(value: unknown): value is string {
  return typeof value === 'string' && VAR_PATTERN.test(value)
}

function parseVariableRef(value: string): VariableRef | null {
  const match = value.match(VAR_PATTERN)
  if (!match) return null

  const path = match[1]
  const dotIndex = path.indexOf('.')
  if (dotIndex === -1) return null

  return {
    nodeLabel: path.slice(0, dotIndex),
    fieldName: path.slice(dotIndex + 1),
    nodeId: '',
    fieldType: '',
  }
}

function formatVariableRef(ref: VariableRef) {
  return `{{${ref.nodeLabel}.${ref.fieldName}}}`
}

function displayVariableRef(value: string) {
  return value.replace(VAR_PATTERN, '$1')
}

export { displayVariableRef, formatVariableRef, isVariableRef, parseVariableRef, VAR_PATTERN }
