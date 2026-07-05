import { z } from 'zod'

export const knowledgeListInputSchema = z.object({
  query: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
  includeDisabled: z.boolean().default(false),
})

export const knowledgeRetrieveInputSchema = z.object({
  knowledgeBaseId: z.string(),
  query: z.string().min(1),
  topK: z.number().int().min(1).max(20).default(5),
  scoreThreshold: z.number().min(-1).max(1).default(0),
  maxContextTokens: z.number().int().min(128).max(20000).default(4000),
})

export type KnowledgeListInput = z.infer<typeof knowledgeListInputSchema>
export type KnowledgeRetrieveInput = z.infer<typeof knowledgeRetrieveInputSchema>
