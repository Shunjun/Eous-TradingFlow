import type { ExecuteContext } from '../types'
import type { ExecuteInput, ExecuteOutput } from './types'

async function execute(input: ExecuteInput, ctx: ExecuteContext): Promise<ExecuteOutput> {
  const { providerId, modelId, systemPrompt, userPrompt, temperature, maxTokens } = input

  if (!providerId) throw new Error('providerId is required')
  if (!modelId) throw new Error('modelId is required')
  if (!userPrompt) throw new Error('userPrompt is required')
  if (!ctx.llmService) throw new Error('LLM service not available')

  ctx.log('info', `调用 LLM 自由节点: model=${modelId}`)

  const stream = await ctx.llmService.streamChat({
    providerId,
    modelId,
    context: {
      systemPrompt: systemPrompt || undefined,
      messages: [{ role: 'user', content: userPrompt, timestamp: Date.now() }],
    },
    options: { temperature, maxTokens },
  })

  let fullText = ''
  for await (const event of stream) {
    if (event.type === 'text_delta' && 'delta' in event) {
      fullText += event.delta
    } else if (event.type === 'error') {
      throw new Error(`LLM error: ${'error' in event ? event.error : 'unknown'}`)
    }
  }

  ctx.log('info', `LLM 自由节点完成: ${fullText.length} 字符`)

  return { content: fullText }
}

export { execute }
