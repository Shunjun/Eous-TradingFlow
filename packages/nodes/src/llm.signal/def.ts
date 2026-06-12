import type { NodeDef } from '../types'
export { CanvasNode } from './canvas'

export const def: NodeDef = {
  meta: {
    type: 'llm.signal',
    category: 'llm',
    label: 'LLM 信号',
    icon: 'brain',
    description: '调用 LLM 生成交易信号，输出 JSON 格式的 signal / confidence / reasoning。',
    color: '#F59E0B',
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
      default: '你是一个专业的量化交易分析师。根据用户提供的市场数据，输出交易信号。',
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
    injectMemory: {
      type: 'boolean',
      from: 'panel',
      default: false,
      label: '注入 Agent 记忆',
      description: '执行时检索所选智能体的长期记忆并追加到 System Prompt。',
      ui: 'toggle',
    },
    memoryAgentId: {
      type: 'string',
      from: 'panel',
      default: '',
      label: '记忆来源 Agent',
      ui: 'select',
      optionsSource: { source: 'agents' },
    },
    memoryQuery: {
      type: 'string',
      from: 'panel',
      default: '',
      label: '记忆检索 Query',
      placeholder: '留空时使用 User Prompt',
    },
    temperature: {
      type: 'number',
      from: 'panel',
      default: 0.3,
      label: 'Temperature',
    },
    maxTokens: {
      type: 'number',
      from: 'panel',
      default: 1024,
      label: 'Max Tokens',
    },
  },
  executeOutput: {
    signal: {
      name: 'signal',
      type: 'string',
      source: { field: 'signal' },
      description: '交易信号: buy / sell / hold',
    },
    confidence: {
      name: 'confidence',
      type: 'number',
      source: { field: 'confidence' },
      description: '信号置信度 0-1',
    },
    reasoning: {
      name: 'reasoning',
      type: 'string',
      source: { field: 'reasoning' },
      description: '推理过程',
    },
  },
}
