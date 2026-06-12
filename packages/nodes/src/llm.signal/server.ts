import type { ExecuteContext } from '../types'
import type { ExecuteInput, ExecuteOutput } from './types'

const SIGNAL_SCHEMA = `{
  "signal": "buy" | "sell" | "hold",
  "confidence": 0.0-1.0,
  "reasoning": "string"
}`

async function execute(input: ExecuteInput, ctx: ExecuteContext): Promise<ExecuteOutput> {
  const {
    providerId,
    modelId,
    systemPrompt,
    userPrompt,
    injectMemory,
    memoryAgentId,
    memoryQuery,
    temperature,
    maxTokens,
  } = input

  if (!providerId) throw new Error('providerId is required')
  if (!modelId) throw new Error('modelId is required')
  if (!userPrompt) throw new Error('userPrompt is required')
  if (!ctx.llmService) throw new Error('LLM service not available')

  ctx.log('info', `调用 LLM 信号节点: model=${modelId}`)

  const jsonSystemPrompt = `${systemPrompt}\n\n你必须以如下 JSON 格式输出，不要输出其他内容：\n${SIGNAL_SCHEMA}`

  const stream = await ctx.llmService.streamChat({
    providerId,
    modelId,
    memory: {
      enabled: Boolean(injectMemory),
      agentId: memoryAgentId || undefined,
      query: memoryQuery || userPrompt,
    },
    context: {
      systemPrompt: jsonSystemPrompt,
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

  ctx.log('info', `LLM 返回 ${fullText.length} 字符`)

  const parsed = ctx.llmService.parseJsonWithTolerance(fullText) as Record<string, unknown> | null
  if (!parsed || typeof parsed !== 'object') {
    ctx.log('warn', 'JSON 解析失败，使用容错链重试一次')

    // Retry once with explicit JSON instruction
    const retryStream = await ctx.llmService.streamChat({
      providerId,
      modelId,
      memory: {
        enabled: Boolean(injectMemory),
        agentId: memoryAgentId || undefined,
        query: memoryQuery || userPrompt,
      },
      context: {
        systemPrompt: jsonSystemPrompt,
        messages: [
          { role: 'user', content: userPrompt, timestamp: Date.now() },
          { role: 'assistant', content: fullText, timestamp: Date.now() },
          {
            role: 'user',
            content: '请只输出有效的 JSON，不要包含任何其他文字。',
            timestamp: Date.now(),
          },
        ],
      },
      options: { temperature: 0, maxTokens },
    })

    let retryText = ''
    for await (const event of retryStream) {
      if (event.type === 'text_delta' && 'delta' in event) {
        retryText += event.delta
      }
    }

    const retryParsed = ctx.llmService.parseJsonWithTolerance(retryText) as Record<
      string,
      unknown
    > | null
    if (!retryParsed || typeof retryParsed !== 'object') {
      throw new Error(
        `Failed to parse LLM signal JSON after retry. Raw: ${retryText.slice(0, 200)}`,
      )
    }

    return {
      signal: String(retryParsed.signal ?? 'hold'),
      confidence: Number(retryParsed.confidence ?? 0),
      reasoning: String(retryParsed.reasoning ?? ''),
    }
  }

  return {
    signal: String(parsed.signal ?? 'hold'),
    confidence: Number(parsed.confidence ?? 0),
    reasoning: String(parsed.reasoning ?? ''),
  }
}

export { execute }
