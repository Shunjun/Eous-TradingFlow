import type { OHLCVBar } from '@eous/api-client'

export type CandlestickPattern =
  | 'DOJI'
  | 'HAMMER'
  | 'INVERTED_HAMMER'
  | 'HANGING_MAN'
  | 'SHOOTING_STAR'
  | 'ENGULFING'
  | 'MORNING_STAR'
  | 'EVENING_STAR'
  | 'HARAMI'
  | 'PIERCING'
  | 'DARK_CLOUD_COVER'
  | 'THREE_WHITE_SOLDIERS'
  | 'THREE_BLACK_CROWS'
  | 'INSIDE'

export type CandlestickSignalDirection = 'ANY' | 'BULLISH' | 'BEARISH'

export interface ExecuteInput {
  dataSourceInstanceId: string
  symbol: string
  interval: string
  patterns: CandlestickPattern[] | string
  direction?: CandlestickSignalDirection
  limit?: number
  [key: string]: unknown
}

export interface CandlestickPatternSignal {
  pattern: CandlestickPattern
  value: number
  direction: CandlestickSignalDirection
}

export interface ExecuteOutput {
  triggeredAt: string
  dataSourceInstanceId: string
  symbol: string
  interval: string
  kline: OHLCVBar | null
  matchedSignals: CandlestickPatternSignal[]
  allSignals: Record<string, number>
  scanTime: string
}
