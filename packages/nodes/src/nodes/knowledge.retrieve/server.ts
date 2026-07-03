import type { ExecuteContext } from '../../types'
import type { ExecuteInput, ExecuteOutput } from './types'

async function execute(input: ExecuteInput, ctx: ExecuteContext): Promise<ExecuteOutput> {
  if (!input.knowledgeBaseId) throw new Error('knowledgeBaseId is required')
  if (!input.query?.trim()) throw new Error('query is required')
  if (!ctx.knowledgeService) throw new Error('knowledgeService is not available')

  const result = await ctx.knowledgeService.retrieve(ctx.userId, input.knowledgeBaseId, {
    query: input.query,
    topK: input.topK,
    scoreThreshold: input.scoreThreshold,
    maxContextTokens: input.maxContextTokens,
    retrievalMode: input.retrievalMode,
  })

  ctx.log('info', `知识库检索完成：召回 ${result.chunks.length} 个 chunks。`)

  return {
    context: result.context,
    chunks: result.chunks,
    citations: result.citations,
  }
}

export { execute }
