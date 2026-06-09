import type { NodeDef } from '../types'
export { CanvasNode } from './canvas'

export const def: NodeDef = {
  meta: {
    type: 'source.price',
    category: 'source',
    label: '实时报价',
    icon: 'dollar-sign',
    description: '获取标的的实时行情。需要先在 settings/data-sources 创建数据源 instance。',
    color: '#0EA5E9',
  },
  executeInput: {
    dataSourceInstanceId: {
      type: 'string',
      from: 'panel',
      required: true,
      label: '数据源',
      ui: 'select',
      optionsSource: { source: 'dataSourceInstances' },
    },
    symbol: {
      type: 'string',
      from: 'panel',
      required: true,
      label: '标的代码',
      ui: 'select',
      optionsSource: { source: 'instanceSymbols' },
      acceptTypes: ['string'],
    },
  },
  executeOutput: {
    price: { name: 'price', type: 'number', source: { field: 'price' }, description: '最新价' },
    change: { name: 'change', type: 'number', source: { field: 'change' }, description: '涨跌额' },
    changePercent: {
      name: 'changePercent',
      type: 'number',
      source: { field: 'changePercent' },
      description: '涨跌幅(%)',
    },
    volume: { name: 'volume', type: 'number', source: { field: 'volume' }, description: '成交量' },
    timestamp: {
      name: 'timestamp',
      type: 'number',
      source: { field: 'timestamp' },
      description: '时间戳',
    },
  },
}
