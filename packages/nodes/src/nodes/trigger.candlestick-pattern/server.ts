import type { ExecuteContext } from '../../types'
import type { ExecuteInput, ExecuteOutput } from './types'
import type { OHLCVBar } from '@eous/api-client'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isOhlcvBar(value: unknown): value is OHLCVBar {
  if (!isRecord(value)) return false
  return (
    typeof value.timestamp === 'number' &&
    typeof value.open === 'number' &&
    typeof value.high === 'number' &&
    typeof value.low === 'number' &&
    typeof value.close === 'number' &&
    typeof value.volume === 'number'
  )
}

async function execute(input: ExecuteInput, ctx: ExecuteContext): Promise<ExecuteOutput> {
  const payload = isRecord(ctx.workflowInput?.candlestickPattern)
    ? ctx.workflowInput.candlestickPattern
    : {}
  const now = new Date().toISOString()

  return {
    triggeredAt: now,
    dataSourceInstanceId:
      typeof payload.dataSourceInstanceId === 'string'
        ? payload.dataSourceInstanceId
        : input.dataSourceInstanceId,
    symbol: typeof payload.symbol === 'string' ? payload.symbol : input.symbol,
    interval: typeof payload.interval === 'string' ? payload.interval : input.interval,
    kline: isOhlcvBar(payload.kline) ? payload.kline : null,
    matchedSignals: Array.isArray(payload.matchedSignals)
      ? (payload.matchedSignals as ExecuteOutput['matchedSignals'])
      : [],
    allSignals: isRecord(payload.allSignals)
      ? (payload.allSignals as ExecuteOutput['allSignals'])
      : {},
    scanTime: typeof payload.scanTime === 'string' ? payload.scanTime : now,
  }
}

export { execute }
