import { BaseNode } from '../base-node'
import type { NodeComponentProps, NodeMeta, ParamDef, OutputField } from '../types'

const color = '#0EA5E9'

const meta: NodeMeta = {
  type: 'source.kline',
  category: 'source',
  label: 'K线数据',
  icon: 'candlestick-chart',
  description: '获取标的的历史K线数据',
}

const executeInput: Record<string, ParamDef> = {
  symbol: {
    type: 'string',
    from: 'panel',
    required: true,
    description: '标的代码',
  },
  interval: {
    type: 'string',
    from: 'panel',
    required: true,
    default: '1d',
    description: 'K线周期',
  },
  limit: {
    type: 'number',
    from: 'panel',
    required: true,
    default: 90,
    description: '拉取条数',
  },
}

const executeOutput: Record<string, OutputField> = {
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
}

function CanvasNode({ id, data, selected, status }: NodeComponentProps) {
  const symbol = String(data.symbol ?? '')
  const interval = String(data.interval ?? '1d')
  const limit = Number(data.limit ?? 90)

  const preview = [
    { label: '标的', value: symbol || '--' },
    { label: '周期', value: interval },
    { label: '条数', value: `${limit}条` },
  ]

  return (
    <BaseNode
      id={id}
      color={color}
      label="K线数据"
      status={status}
      selected={selected}
      preview={preview}
    />
  )
}

export { meta, executeInput, executeOutput, CanvasNode }
