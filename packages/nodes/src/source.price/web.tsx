import { BaseNode } from '../base-node'
import type { NodeComponentProps, NodeMeta, OutputField, ParamDef } from '../types'

const NODE_COLOR = '#0EA5E9'

export const meta: NodeMeta = {
  type: 'source.price',
  category: 'source',
  label: '实时报价',
  icon: 'dollar-sign',
  description: '获取标的的实时行情',
}

export const executeInput: Record<string, ParamDef> = {
  symbol: {
    type: 'string',
    from: 'panel',
    required: true,
    description: '标的代码，如 AAPL、BTCUSD',
  },
}

export const executeOutput: Record<string, OutputField> = {
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
}

function formatChangePercent(value: unknown): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function CanvasNode({ id, data, selected, status }: NodeComponentProps) {
  const symbol = typeof data.symbol === 'string' ? data.symbol : '--'
  const price = typeof data.price === 'number' ? data.price.toFixed(2) : '--'
  const changePercent = formatChangePercent(data.changePercent)

  return (
    <BaseNode
      id={id}
      color={NODE_COLOR}
      label={meta.label}
      status={status}
      selected={selected}
      preview={[
        { label: '标的', value: symbol },
        { label: '最新价', value: price },
        { label: '涨跌幅', value: changePercent },
      ]}
    />
  )
}

export { CanvasNode }
