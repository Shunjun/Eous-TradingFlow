import type { ThinkingLevel } from '../types.js'

export function openAiReasoningEffort(level: ThinkingLevel): string {
  if (level === 'off') return 'none'
  if (level === 'max' || level === 'xhigh') return 'high'
  return level
}

export function isOpenAiOfficial(kind: string): boolean {
  return kind.toLowerCase() === 'openai'
}
