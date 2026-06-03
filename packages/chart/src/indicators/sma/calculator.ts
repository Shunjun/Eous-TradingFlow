import { SMA } from 'technicalindicators'
import type { IndicatorDataPoint, IndicatorOutput } from '../../types'

export function calculateSMA(
  closes: { time: import('lightweight-charts').Time; close: number }[],
  period: number,
): IndicatorOutput {
  if (closes.length < period) return [[]]

  const values = closes.map((c) => c.close)
  const result = SMA.calculate({ period, values })

  const output: IndicatorDataPoint[] = result.map((value, i) => ({
    time: closes[period - 1 + i].time,
    value,
  }))

  return [output]
}
