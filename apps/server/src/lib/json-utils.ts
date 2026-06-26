/**
 * JSON tolerance chain for LLM outputs:
 * 1. Direct JSON.parse
 * 2. Extract ```json ... ``` code block
 * 3. Extract { ... } object
 * 4. On failure, returns null
 */
export function parseJsonWithTolerance(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    // continue
  }

  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim())
    } catch {
      // continue
    }
  }

  const objectMatch = text.match(/\{[\s\S]*\}/)
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0])
    } catch {
      // continue
    }
  }

  return null
}
