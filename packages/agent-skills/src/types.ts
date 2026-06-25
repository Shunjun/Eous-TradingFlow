import type { z } from 'zod'

export interface AgentSkillContext {
  userId: string
  agentId?: string
  sessionId?: string
}

export interface AgentSkillTool<TInput = unknown, TOutput = unknown> {
  id: string
  description: string
  inputSchema: z.ZodType<TInput>
  readOnly?: boolean
  destructive?: boolean
  execute: (context: AgentSkillContext, input: TInput) => Promise<TOutput>
}

export interface AgentSkill {
  id: string
  name: string
  description?: string
  tools: AgentSkillTool<any, any>[]
}
