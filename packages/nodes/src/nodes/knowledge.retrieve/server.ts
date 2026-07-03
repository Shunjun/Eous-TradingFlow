import type { ExecuteContext } from '../../types'
import type { ExecuteInput, ExecuteOutput } from './types'

async function execute(input: ExecuteInput, ctx: ExecuteContext): Promise<ExecuteOutput> {
  if (!input.knowledgeBaseId) throw new Error('knowledgeBaseId is required')
  if (!input.query?.trim()) throw new Error('query is required')

  ctx.log('warn', '知识库检索节点已配置，但向量检索执行尚未接入；当前返回空检索结果。')

  return {
    context: '',
    chunks: [],
    citations: [],
  }
}

export { execute }
