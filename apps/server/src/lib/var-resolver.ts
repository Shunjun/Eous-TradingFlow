/**
 * Variable resolver for workflow node execution.
 *
 * Supports two modes:
 * - Whole-value: entire value matches `^{{...}}$` → replaced with the actual value (any type)
 * - Embedded: value is a string containing `{{...}}` → partial replacement (result is always string)
 *
 * When a string value is embedded inside an expression, it is automatically quoted
 * to avoid ReferenceError (e.g. `'long'` instead of `long`).
 */

const WHOLE_VAR_RE = /^{{([^{}]+)}}$/
const EMBEDDED_VAR_RE = /{{([^{}]+)}}/g
const NODE_ID_REF_PREFIX = 'node:'

/**
 * Resolve a value that may contain variable references.
 * - If the entire value is `{{path}}`, returns the resolved value as-is (any type).
 * - Otherwise returns the original value unchanged.
 */
export function resolveValue(
  value: unknown,
  cache: Record<string, Record<string, unknown>>,
  nodes: Array<{ id: string; type: string; data?: Record<string, unknown> }>,
): unknown {
  if (typeof value !== 'string') return value

  const m = value.match(WHOLE_VAR_RE)
  if (!m) return value

  const path = m[1]
  return resolvePath(path, cache, nodes, false)
}

/**
 * Resolve a string that may contain embedded variable references `{{path}}`.
 * If the string has no `{{}}`, returns it as-is.
 * If the entire string is a single `{{path}}`, returns the raw resolved value.
 * Otherwise, performs partial string substitution with auto-quoting.
 */
export function resolveString(
  str: string,
  cache: Record<string, Record<string, unknown>>,
  nodes: Array<{ id: string; type: string; data?: Record<string, unknown> }>,
): string {
  // Entire value is a single variable — return raw resolved value
  const whole = str.match(WHOLE_VAR_RE)
  if (whole) {
    const val = resolvePath(whole[1], cache, nodes, false)
    return String(val)
  }

  // Embedded variables in a larger string
  if (!EMBEDDED_VAR_RE.test(str)) return str

  // Reset regex lastIndex after test
  EMBEDDED_VAR_RE.lastIndex = 0

  return str.replace(EMBEDDED_VAR_RE, (_match, path: string) => {
    const val = resolvePath(path, cache, nodes, true)
    return String(val)
  })
}

function resolvePath(
  path: string,
  cache: Record<string, Record<string, unknown>>,
  nodes: Array<{ id: string; type: string; data?: Record<string, unknown> }>,
  embedded: boolean,
): unknown {
  const explicitNodeRef = parseExplicitNodeRef(path)
  if (!explicitNodeRef) {
    throw new Error(`变量引用格式错误: {{{path}}}，需要 "node:<nodeId>:<field>" 格式`)
  }

  const node = nodes.find((item) => item.id === explicitNodeRef.nodeId)
  if (!node) {
    throw new Error(`变量引用解析失败: {{{path}}}, 原因: 找不到节点 "${explicitNodeRef.nodeId}"`)
  }

  return resolveNodeField(node.id, explicitNodeRef.fieldPath, path, cache, embedded)
}

function parseExplicitNodeRef(path: string): { nodeId: string; fieldPath: string } | null {
  if (!path.startsWith(NODE_ID_REF_PREFIX)) return null
  const rest = path.slice(NODE_ID_REF_PREFIX.length)
  const separatorIndex = rest.indexOf(':')
  if (separatorIndex === -1) {
    throw new Error(`变量引用格式错误: {{{path}}}，需要 "node:<nodeId>:<field>" 格式`)
  }
  const nodeId = rest.slice(0, separatorIndex)
  const fieldPath = rest.slice(separatorIndex + 1)
  if (!nodeId || !fieldPath) {
    throw new Error(`变量引用格式错误: {{{path}}}，需要 "node:<nodeId>:<field>" 格式`)
  }
  return { nodeId, fieldPath }
}

function resolveNodeField(
  nodeId: string,
  fieldPath: string,
  originalPath: string,
  cache: Record<string, Record<string, unknown>>,
  embedded: boolean,
): unknown {
  const nodeCache = cache[nodeId]
  if (!nodeCache) {
    throw new Error(`变量引用解析失败: {{{originalPath}}}, 原因: 节点 "${nodeId}" 没有输出缓存`)
  }

  const val = accessPath(nodeCache, fieldPath)
  if (val === undefined) {
    throw new Error(
      `变量引用解析失败: {{{originalPath}}}, 原因: 节点 "${nodeId}" 没有字段 "${fieldPath}"`,
    )
  }

  // When embedded in a string expression, auto-quote string values
  if (embedded && typeof val === 'string') {
    return `'${val}'`
  }

  return val
}

function splitPath(path: string): string[] {
  const parts: string[] = []
  let current = ''
  for (let i = 0; i < path.length; i++) {
    const ch = path[i]
    if (ch === '.' || ch === '[' || ch === ']') {
      if (current) parts.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current) parts.push(current)
  return parts
}

function accessPath(obj: Record<string, unknown>, path: string): unknown {
  const segments = splitPath(path)
  let current: unknown = obj
  for (const seg of segments) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[seg]
  }
  return current
}
