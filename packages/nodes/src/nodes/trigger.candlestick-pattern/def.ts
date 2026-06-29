import type { NodeDef } from '../../types'
export { getCanvasView } from './canvas'

export const CANDLESTICK_PATTERN_OPTIONS = [
  { label: 'Doji', value: 'DOJI' },
  { label: 'Hammer', value: 'HAMMER' },
  { label: 'Inverted Hammer', value: 'INVERTED_HAMMER' },
  { label: 'Hanging Man', value: 'HANGING_MAN' },
  { label: 'Shooting Star', value: 'SHOOTING_STAR' },
  { label: 'Engulfing', value: 'ENGULFING' },
  { label: 'Morning Star', value: 'MORNING_STAR' },
  { label: 'Evening Star', value: 'EVENING_STAR' },
  { label: 'Harami', value: 'HARAMI' },
  { label: 'Piercing', value: 'PIERCING' },
  { label: 'Dark Cloud Cover', value: 'DARK_CLOUD_COVER' },
  { label: 'Three White Soldiers', value: 'THREE_WHITE_SOLDIERS' },
  { label: 'Three Black Crows', value: 'THREE_BLACK_CROWS' },
  { label: 'Inside Bar', value: 'INSIDE' },
] as const

export const def: NodeDef = {
  meta: {
    type: 'trigger.candlestick-pattern',
    category: 'trigger',
    label: 'K线形态触发',
    icon: 'candlestick-chart',
    description: '在指定数据源、标的和K线周期上持续扫描K线形态。',
    color: '#14B8A6',
  },
  connection: {
    source: true,
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
      default: '5m',
      label: 'K线周期',
      ui: 'select',
      optionsSource: { source: 'instanceIntervals' },
    },
    patterns: {
      type: 'string',
      from: 'panel',
      required: true,
      default: 'HAMMER',
      label: '形态',
      ui: 'select',
      options: [...CANDLESTICK_PATTERN_OPTIONS],
    },
    direction: {
      type: 'string',
      from: 'panel',
      required: true,
      default: 'ANY',
      label: '信号方向',
      ui: 'select',
      options: [
        { label: '任意', value: 'ANY' },
        { label: '看涨', value: 'BULLISH' },
        { label: '看跌', value: 'BEARISH' },
      ],
    },
    limit: {
      type: 'number',
      from: 'panel',
      required: true,
      default: 120,
      label: '扫描K线数',
    },
  },
  executeOutput: {
    symbol: {
      name: 'symbol',
      type: 'string',
      source: { field: 'symbol' },
      description: '命中标的',
    },
    interval: {
      name: 'interval',
      type: 'string',
      source: { field: 'interval' },
      description: 'K线周期',
    },
    kline: {
      name: 'kline',
      type: 'object',
      source: { field: 'kline' },
      description: '命中信号对应的K线',
    },
    matchedSignals: {
      name: 'matchedSignals',
      type: 'array',
      source: { field: 'matchedSignals' },
      description: '命中的形态信号',
    },
    allSignals: {
      name: 'allSignals',
      type: 'object',
      source: { field: 'allSignals' },
      description: '本次扫描的所有形态信号',
    },
    scanTime: {
      name: 'scanTime',
      type: 'string',
      source: { field: 'scanTime' },
      description: '扫描时间',
    },
  },
}
