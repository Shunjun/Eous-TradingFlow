import type { ExecuteContext } from '../../types'
import type { ExecuteInput, ExecuteOutput } from './types'

async function execute(input: ExecuteInput, ctx: ExecuteContext): Promise<ExecuteOutput> {
  const { symbol, interval, limit, dataSourceInstanceId } = input

  if (!dataSourceInstanceId) {
    throw new Error('dataSourceInstanceId is required')
  }

  ctx.log('info', `开始拉取 K 线: ${symbol} ${interval} limit=${limit}`)

  const klines = await ctx.dataSourceService.getKlines(ctx.userId, dataSourceInstanceId, {
    symbol,
    interval,
    limit,
    mode: 'include-live',
  })

  if (klines.length === 0) {
    ctx.log(
      'warn',
      `返回 0 条数据 — 可能是网络问题、API 限流、symbol 不存在、或 instance config 缺失`,
    )
  }

  const bars = klines.map((k) => ({
    ...k,
    volume: k.volume ?? 0,
  }))

  ctx.log('info', `成功拉取 ${bars.length} 条 K 线`)

  return {
    bars,
    symbol,
    interval,
  }
}

export { execute }
