import { BollingerBands } from 'technicalindicators'
import type { IndicatorDataPoint, IndicatorOutput } from '../../types'

export function calculateBollingerBands(
  closes: { time: import('lightweight-charts').Time; close: number }[],
  params: { period?: number; stdDev?: number } = {},
): IndicatorOutput {
  const { period = 20, stdDev = 2 } = params
  if (closes.length < period) return [[], [], []]

  const values = closes.map((c) => c.close)
  const result = BollingerBands.calculate({ period, stdDev, values })

  const upper: IndicatorDataPoint[] = []
  const middle: IndicatorDataPoint[] = []
  const lower: IndicatorDataPoint[] = []

  for (let i = 0; i < result.length; i++) {
    const time = closes[period - 1 + i].time
    upper.push({ time, value: result[i].upper })
    middle.push({ time, value: result[i].middle })
    lower.push({ time, value: result[i].lower })
  }

  return [upper, middle, lower]
}
