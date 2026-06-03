import { RSI } from 'technicalindicators'
import type { IndicatorDataPoint, IndicatorOutput } from '../../types'

export function calculateRSI(
  closes: { time: import('lightweight-charts').Time; close: number }[],
  period: number,
): IndicatorOutput {
  if (closes.length < period + 1) return [[]]

  const values = closes.map((c) => c.close)
  const result = RSI.calculate({ period, values })

  const output: IndicatorDataPoint[] = result.map((value, i) => ({
    // RSI outputs start at index `period` (needs period+1 closes to compute first RSI)
    time: closes[period + i].time,
    value,
  }))

  return [output]
}
