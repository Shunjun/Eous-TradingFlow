import type { NodeDef } from '../types'
export { CanvasNode } from './canvas'

export const def: NodeDef = {
  meta: {
    type: 'llm.report',
    category: 'llm',
    label: 'LLM 报告',
    icon: 'file-text',
    description: '调用 LLM 生成 Markdown 格式的分析报告。',
    color: '#10B981',
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
      required: true,
      default: '你是一个专业的金融分析师。请根据用户提供的数据生成详细的 Markdown 分析报告。',
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
    report: {
      name: 'report',
      type: 'string',
      source: { field: 'report' },
      description: 'Markdown 格式的分析报告',
    },
  },
}
