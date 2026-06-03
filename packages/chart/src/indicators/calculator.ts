import type { IndicatorDataPoint, IndicatorOutput } from '../types'

interface ClosePoint {
  time: import('lightweight-charts').Time
  close: number
}

// ── SMA ─────────────────────────────────────────────────────────────────────

export function sma(closes: ClosePoint[], period: number): IndicatorOutput {
  if (closes.length < period) return [[]]

  const result: IndicatorDataPoint[] = []
  let sum = 0

  for (let i = 0; i < period; i++) {
    sum += closes[i].close
  }
  result.push({ time: closes[period - 1].time, value: sum / period })

  for (let i = period; i < closes.length; i++) {
    sum += closes[i].close - closes[i - period].close
    result.push({ time: closes[i].time, value: sum / period })
  }

  return [result]
}

// ── EMA ─────────────────────────────────────────────────────────────────────

export function ema(closes: ClosePoint[], period: number): IndicatorOutput {
  if (closes.length < period) return [[]]

  const k = 2 / (period + 1)
  let sum = 0
  for (let i = 0; i < period; i++) {
    sum += closes[i].close
  }

  let prev = sum / period
  const result: IndicatorDataPoint[] = [{ time: closes[period - 1].time, value: prev }]

  for (let i = period; i < closes.length; i++) {
    prev = closes[i].close * k + prev * (1 - k)
    result.push({ time: closes[i].time, value: prev })
  }

  return [result]
}

// ── MACD ────────────────────────────────────────────────────────────────────

export function macd(
  closes: ClosePoint[],
  params: { fast?: number; slow?: number; signal?: number } = {},
): IndicatorOutput {
  const { fast = 12, slow = 26, signal = 9 } = params

  const emaFast = ema(closes, fast)[0]
  const emaSlow = ema(closes, slow)[0]

  // Build lookup for slow EMA by time
  const slowMap = new Map(emaSlow.map((p) => [String(p.time), p.value]))

  // MACD line = fast EMA - slow EMA
  const macdLine: IndicatorDataPoint[] = []
  for (const p of emaFast) {
    const slowVal = slowMap.get(String(p.time))
    if (slowVal !== undefined) {
      macdLine.push({ time: p.time, value: p.value - slowVal })
    }
  }

  // Signal line = EMA of MACD line
  const signalInput = macdLine.map((p) => ({ time: p.time, close: p.value }))
  const signalLine = ema(signalInput, signal)[0]

  // Histogram = MACD - signal
  const sigMap = new Map(signalLine.map((p) => [String(p.time), p.value]))
  const histogram: IndicatorDataPoint[] = []
  for (const p of macdLine) {
    const sigVal = sigMap.get(String(p.time))
    if (sigVal !== undefined) {
      histogram.push({ time: p.time, value: p.value - sigVal })
    }
  }

  return [macdLine, signalLine, histogram]
}
