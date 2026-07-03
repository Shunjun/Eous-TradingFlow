import type { NodeDef } from '../../types'
export { getCanvasView } from './canvas'

export const def: NodeDef = {
  meta: {
    type: 'knowledge.retrieve',
    category: 'source',
    label: '知识库检索',
    icon: 'database',
    description: '从知识库召回相关 chunks，输出上下文、chunks 和引用信息。',
    color: '#14B8A6',
  },
  connection: {
    target: true,
    source: true,
  },
  executeInput: {
    knowledgeBaseId: {
      type: 'string',
      from: 'panel',
      required: true,
      label: '知识库',
      ui: 'select',
      optionsSource: { source: 'knowledgeBases' },
    },
    query: {
      type: 'string',
      from: 'panel',
      required: true,
      label: '检索问题',
      ui: 'textarea',
      placeholder: '可以引用上游变量，如 {{Start.userInput}}',
      acceptTypes: ['string'],
    },
    topK: {
      type: 'number',
      from: 'panel',
      default: 5,
      label: 'Top K',
    },
    scoreThreshold: {
      type: 'number',
      from: 'panel',
      default: 0.25,
      label: 'Score Threshold',
    },
    maxContextTokens: {
      type: 'number',
      from: 'panel',
      default: 2000,
      label: 'Max Context Tokens',
    },
    retrievalMode: {
      type: 'string',
      from: 'panel',
      default: 'vector',
      label: '检索模式',
      ui: 'select',
      options: [
        { label: 'Vector', value: 'vector' },
        { label: 'Hybrid', value: 'hybrid' },
      ],
    },
  },
  executeOutput: {
    context: {
      name: 'context',
      type: 'string',
      source: { field: 'context' },
      description: '拼接后的检索上下文',
    },
    chunks: {
      name: 'chunks',
      type: 'object',
      source: { field: 'chunks' },
      description: '召回 chunk 列表',
    },
    citations: {
      name: 'citations',
      type: 'object',
      source: { field: 'citations' },
      description: '引用来源',
    },
  },
}
