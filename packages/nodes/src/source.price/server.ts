import { getDataSourceProvider } from '@eous/data-sources'
import type { ExecuteContext } from '../types'
import type { ExecuteInput, ExecuteOutput } from './types'

export async function execute(input: ExecuteInput, ctx: ExecuteContext): Promise<ExecuteOutput> {
  const { symbol, dataSourceInstanceId } = input

  if (!dataSourceInstanceId) {
    throw new Error('dataSourceInstanceId is required')
  }

  const instanceConfig = await ctx.dataSourceService.getInstanceConfig(ctx.userId, dataSourceInstanceId)
  const provider = getDataSourceProvider(instanceConfig.providerKind)
  if (!provider) throw new Error(`Unknown provider: ${instanceConfig.providerKind}`)

  ctx.log('info', `开始拉取实时报价: ${symbol}`)

  const quote = await provider.getQuote(symbol, instanceConfig.config)

  if (quote.price === 0) {
    ctx.log('warn', `返回价格为 0 — 可能是网络问题、API 限流、symbol 不存在、或 instance config 缺失`)
  }

  ctx.log('info', `成功获取报价: ${quote.price}`)

  return {
    price: quote.price,
    change: quote.change ?? 0,
    changePercent: quote.changePercent ?? 0,
    volume: quote.volume ?? 0,
    timestamp: quote.timestamp,
  }
}
