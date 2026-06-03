import { MACD } from 'technicalindicators'
import type { IndicatorDataPoint, IndicatorOutput } from '../../types'

export function calculateMACD(
  closes: { time: import('lightweight-charts').Time; close: number }[],
  params: { fast?: number; slow?: number; signal?: number } = {},
): IndicatorOutput {
  const { fast = 12, slow = 26, signal = 9 } = params
  const values = closes.map((c) => c.close)

  const result = MACD.calculate({
    values,
    fastPeriod: fast,
    slowPeriod: slow,
    signalPeriod: signal,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  })

  const macdLine: IndicatorDataPoint[] = []
  const signalLine: IndicatorDataPoint[] = []
  const histogram: IndicatorDataPoint[] = []

  // MACD results start at index `slow - 1`
  const offset = slow - 1

  for (let i = 0; i < result.length; i++) {
    const time = closes[offset + i].time
    if (result[i].MACD !== undefined) {
      macdLine.push({ time, value: result[i].MACD! })
    }
    if (result[i].signal !== undefined) {
      signalLine.push({ time, value: result[i].signal! })
    }
    if (result[i].histogram !== undefined) {
      histogram.push({ time, value: result[i].histogram! })
    }
  }

  return [macdLine, signalLine, histogram]
}
