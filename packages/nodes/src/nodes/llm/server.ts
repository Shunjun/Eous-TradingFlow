import type { ExecuteContext } from '../../types'
import type { ExecuteInput, ExecuteOutput } from './types'

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseSchema(schemaJson?: string): Record<string, unknown> | null {
  if (!schemaJson?.trim()) return null
  const parsed = JSON.parse(schemaJson) as unknown
  if (!isObject(parsed)) throw new Error('schemaJson must be a JSON object')
  return parsed
}

function buildSystemPrompt(input: ExecuteInput, schema: Record<string, unknown> | null): string {
  const base = input.systemPrompt?.trim() ?? ''
  if (input.responseFormat === 'markdown') {
    return [base, '请以 Markdown 格式输出。'].filter(Boolean).join('\n\n')
  }

  if (input.responseFormat !== 'json_schema') return base

  const schemaName = input.schemaName?.trim() || 'llm_output'
  const schemaText = schema ? JSON.stringify(schema, null, 2) : '{}'
  const strictText = input.strictSchema === false ? '尽量' : '必须'

  return [
    base,
    `${strictText}只输出有效 JSON，不要包含 Markdown 代码块或解释性文字。`,
    `输出对象名称: ${schemaName}`,
    `JSON Schema:\n${schemaText}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

async function collectText(stream: AsyncIterable<{ type: string; [key: string]: unknown }>) {
  let fullText = ''
  for await (const event of stream) {
    if (event.type === 'text_delta' && typeof event.delta === 'string') {
      fullText += event.delta
    } else if (event.type === 'error') {
      throw new Error(`LLM error: ${'error' in event ? event.error : 'unknown'}`)
    }
  }
  return fullText
}

async function execute(input: ExecuteInput, ctx: ExecuteContext): Promise<ExecuteOutput> {
  const { providerId, modelId, userPrompt, temperature, maxTokens } = input

  if (!providerId) throw new Error('providerId is required')
  if (!modelId) throw new Error('modelId is required')
  if (!userPrompt) throw new Error('userPrompt is required')
  if (!ctx.llmService) throw new Error('LLM service not available')

  const responseFormat = input.responseFormat || 'text'
  const schema = responseFormat === 'json_schema' ? parseSchema(input.schemaJson) : null
  const systemPrompt = buildSystemPrompt({ ...input, responseFormat }, schema)

  ctx.log('info', `调用 LLM 节点: model=${modelId}, format=${responseFormat}`)

  const stream = await ctx.llmService.streamChat({
    providerId,
    modelId,
    context: {
      systemPrompt: systemPrompt || undefined,
      messages: [{ role: 'user', content: userPrompt, createdAt: Date.now() }],
    },
    options: {
      temperature,
      maxTokens,
      responseFormat,
      schema,
      schemaName: input.schemaName,
      strictSchema: input.strictSchema !== false,
    },
  })

  const raw = await collectText(stream)

  if (responseFormat !== 'json_schema') {
    ctx.log('info', `LLM 节点完成: ${raw.length} 字符`)
    return { content: raw, raw }
  }

  const parsed = ctx.llmService.parseJsonWithTolerance(raw)
  if (isObject(parsed) || Array.isArray(parsed)) {
    return {
      content: JSON.stringify(parsed, null, 2),
      json: parsed,
      raw,
    }
  }

  if (input.strictSchema === false) {
    ctx.log('warn', 'JSON Schema 输出解析失败，返回原始文本')
    return { content: raw, raw }
  }

  throw new Error(`Failed to parse LLM JSON output. Raw: ${raw.slice(0, 200)}`)
}

export { execute }
