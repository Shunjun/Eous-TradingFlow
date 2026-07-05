import type { z } from 'zod'
import type { AgentSkill, AgentSkillContext, AgentSkillTool } from '../../types.js'
import type { KnowledgeCapability, KnowledgeBaseRecord } from '../capability.js'
import {
  knowledgeListInputSchema,
  knowledgeRetrieveInputSchema,
  type KnowledgeListInput,
  type KnowledgeRetrieveInput,
} from '../schemas.js'

function makeTool<TInput, TOutput>(
  tool: AgentSkillTool<TInput, TOutput>,
): AgentSkillTool<TInput, TOutput> {
  return tool
}

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value
}

function toKnowledgeBaseDTO(base: KnowledgeBaseRecord) {
  return {
    id: base.id,
    name: base.name,
    description: base.description,
    enabled: base.enabled,
    activeIndexId: base.activeIndexId,
    updatedAt: toIsoString(base.updatedAt),
  }
}

export function createKnowledgeSkill(capability: KnowledgeCapability): AgentSkill {
  const tools = [
    makeTool({
      id: 'knowledge_list',
      description:
        'List knowledge bases available to the current user. Use this before retrieval when the target knowledge base id is unknown.',
      inputSchema: knowledgeListInputSchema as z.ZodType<KnowledgeListInput>,
      readOnly: true,
      async execute(context: AgentSkillContext, input: KnowledgeListInput) {
        const knowledgeBases = await capability.list({
          userId: context.userId,
          query: input.query,
          limit: input.limit,
          includeDisabled: input.includeDisabled,
        })

        return {
          knowledgeBases: knowledgeBases.map(toKnowledgeBaseDTO),
        }
      },
    }),
    makeTool({
      id: 'knowledge_retrieve',
      description:
        'Retrieve relevant chunks from a knowledge base using vector search. Returns a composed context plus scored source chunks.',
      inputSchema: knowledgeRetrieveInputSchema as z.ZodType<KnowledgeRetrieveInput>,
      readOnly: true,
      async execute(context: AgentSkillContext, input: KnowledgeRetrieveInput) {
        return capability.retrieve({
          userId: context.userId,
          knowledgeBaseId: input.knowledgeBaseId,
          query: input.query,
          topK: input.topK,
          scoreThreshold: input.scoreThreshold,
          maxContextTokens: input.maxContextTokens,
        })
      },
    }),
  ] satisfies AgentSkillTool<any, any>[]

  return {
    id: '@eous/knowledge',
    name: 'Knowledge Base',
    description: 'List and retrieve Eous knowledge base context for grounded agent answers.',
    tools,
  }
}
