import type { NodeDef } from '../../types'
export { getCanvasView } from './canvas'

export const def: NodeDef = {
  meta: {
    type: 'llm',
    category: 'llm',
    label: 'LLM',
    icon: 'message-square',
    description: '调用 LLM 生成文本、Markdown 或按 JSON Schema 约束的结构化输出。',
    color: '#8B5CF6',
  },
  connection: {
    target: true,
  },
  executeInput: {
    providerId: {
      type: 'string',
      from: 'panel',
      required: true,
      label: '模型',
      ui: 'providerModel',
    },
    modelId: {
      type: 'string',
      from: 'panel',
      required: true,
      hidden: true,
    },
    systemPrompt: {
      type: 'string',
      from: 'panel',
      default: '',
      label: 'System Prompt',
      ui: 'textarea',
    },
    userPrompt: {
      type: 'string',
      from: 'panel',
      required: true,
      label: 'User Prompt',
      ui: 'textarea',
      placeholder: '引用上游变量，如 {{K线数据.bars}}',
    },
    responseFormat: {
      type: 'string',
      from: 'panel',
      default: 'text',
      label: '输出格式',
      ui: 'select',
      options: [
        { label: 'Text', value: 'text' },
        { label: 'Markdown', value: 'markdown' },
        { label: 'JSON Schema', value: 'json_schema' },
      ],
    },
    schemaName: {
      type: 'string',
      from: 'panel',
      default: 'llm_output',
      label: 'Schema 名称',
      placeholder: '例如 trading_signal',
    },
    schemaJson: {
      type: 'string',
      from: 'panel',
      default: '',
      label: 'JSON Schema',
      ui: 'code',
      placeholder:
        '{\n  "type": "object",\n  "properties": {\n    "signal": { "type": "string", "enum": ["buy", "sell", "hold"] },\n    "confidence": { "type": "number" },\n    "reasoning": { "type": "string" }\n  },\n  "required": ["signal", "confidence", "reasoning"]\n}',
    },
    strictSchema: {
      type: 'boolean',
      from: 'panel',
      default: true,
      label: '强制 JSON 输出',
      ui: 'toggle',
    },
    temperature: {
      type: 'number',
      from: 'panel',
      default: 0.7,
      label: 'Temperature',
    },
    maxTokens: {
      type: 'number',
      from: 'panel',
      default: 2048,
      label: 'Max Tokens',
    },
  },
  executeOutput: {
    content: {
      name: 'content',
      type: 'string',
      source: { field: 'content' },
      description: 'LLM 返回文本；JSON Schema 模式下为格式化后的 JSON 字符串',
    },
    json: {
      name: 'json',
      type: 'object',
      source: { field: 'json' },
      description: 'JSON Schema 模式下解析后的对象',
    },
    raw: {
      name: 'raw',
      type: 'string',
      source: { field: 'raw' },
      description: '模型原始返回',
    },
  },
}
