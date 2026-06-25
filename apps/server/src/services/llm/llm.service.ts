import { getAgentRuntime } from '../agent-runtime/runtime.js'
import type { RuntimeStream, RuntimeStreamOptions } from '../agent-runtime/types.js'

export async function streamChat(options: RuntimeStreamOptions): Promise<RuntimeStream> {
  return getAgentRuntime().streamChat(options)
}

export async function generateText(options: RuntimeStreamOptions): Promise<string> {
  return getAgentRuntime().generateText(options)
}

/**
 * JSON tolerance chain for LLM outputs (docs/05-agent-llm.md):
 * 1. Direct JSON.parse
 * 2. Extract ```json ... ``` code block
 * 3. Extract { ... } object
 * 4. On failure, returns null (caller decides retry)
 */
export function parseJsonWithTolerance(text: string): unknown {
  // 1. Direct parse
  try {
    return JSON.parse(text)
  } catch {
    // continue
  }

  // 2. Extract ```json ... ``` code block
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim())
    } catch {
      // continue
    }
  }

  // 3. Extract { ... } object
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
