import type { NodeDef } from '../../types'
export { getCanvasView } from './canvas'

export const def: NodeDef = {
  meta: {
    type: 'llm.free',
    category: 'llm',
    label: 'LLM 自由',
    icon: 'message-square',
    description: '调用 LLM 生成自定义内容，透传 LLM 返回的原始文本。',
    color: '#8B5CF6',
  },
  executeInput: {
    providerId: {
      type: 'string',
      from: 'panel',
      required: true,
      label: 'Provider',
      ui: 'select',
      optionsSource: { source: 'providers' },
    },
    modelId: {
      type: 'string',
      from: 'panel',
      required: true,
      label: '模型',
      ui: 'select',
      optionsSource: { source: 'providerModels', providerIdField: 'providerId' },
    },
    systemPrompt: {
      type: 'string',
      from: 'panel',
      default: '',
      label: 'System Prompt',
      ui: 'code',
    },
    userPrompt: {
      type: 'string',
      from: 'panel',
      required: true,
      label: 'User Prompt',
      ui: 'code',
      placeholder: '引用上游变量，如 {{K线数据.bars}}',
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
      description: 'LLM 返回的原始文本',
    },
  },
}
