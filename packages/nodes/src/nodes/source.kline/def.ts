import type { NodeDef } from '../../types'
export { getCanvasView } from './canvas'

export const def: NodeDef = {
  meta: {
    type: 'source.kline',
    category: 'source',
    label: 'K线数据',
    icon: 'candlestick-chart',
    description: '获取标的的历史K线数据。需要先在 settings/data-sources 创建数据源 instance。',
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
    interval: {
      type: 'string',
      from: 'panel',
      required: true,
      default: '1d',
      label: 'K线周期',
      ui: 'select',
      optionsSource: { source: 'instanceIntervals' },
    },
    limit: {
      type: 'number',
      from: 'panel',
      required: true,
      default: 90,
      label: '拉取条数',
    },
  },
  executeOutput: {
    bars: {
      name: 'bars',
      type: 'OHLCVBar[]',
      source: { field: 'bars' },
      description: 'K线数据数组',
    },
    symbol: {
      name: 'symbol',
      type: 'string',
      source: { field: 'symbol' },
      description: '标的代码',
    },
    interval: {
      name: 'interval',
      type: 'string',
      source: { field: 'interval' },
      description: 'K线周期',
    },
  },
}
