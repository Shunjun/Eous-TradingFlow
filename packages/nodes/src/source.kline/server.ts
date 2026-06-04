import type { OHLCVBar } from '@eous/types'
import type { ExecuteContext } from '../types'
import type { ExecuteInput, ExecuteOutput } from './types'

interface KlineDataSource {
  getKlines(params: { symbol: string; interval: string; limit: number }): Promise<OHLCVBar[]>
}

function isKlineDataSource(value: unknown): value is KlineDataSource {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getKlines' in value &&
    typeof (value as Record<string, unknown>).getKlines === 'function'
  )
}

function buildMockBars(limit: number): OHLCVBar[] {
  const bars: OHLCVBar[] = []
  const baseTs = Date.now() - limit * 86_400_000

  for (let i = 0; i < limit; i++) {
    const open = 100 + Math.random() * 50
    const close = open + (Math.random() - 0.5) * 10
    const high = Math.max(open, close) + Math.random() * 5
    const low = Math.min(open, close) - Math.random() * 5

    bars.push({
      timestamp: baseTs + i * 86_400_000,
      open,
      high,
      low,
      close,
      volume: Math.floor(Math.random() * 1_000_000),
    })
  }

  return bars
}

async function execute(input: ExecuteInput, ctx: ExecuteContext): Promise<ExecuteOutput> {
  let bars: OHLCVBar[]

  if (isKlineDataSource(ctx.dataSource)) {
    bars = await ctx.dataSource.getKlines({
      symbol: input.symbol,
      interval: input.interval,
      limit: input.limit,
    })
  } else {
    bars = buildMockBars(input.limit)
  }

  return {
    bars,
    symbol: input.symbol,
    interval: input.interval,
  }
}

export { execute }
