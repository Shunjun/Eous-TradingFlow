import type { Kline } from '@eous/data-sources'

export type KlineReadMode = 'closed-only' | 'include-live'
export type KlineRequestPriority = 'interactive' | 'background' | 'workflow'
export type KlineQueryKind = 'latest' | 'before' | 'range'

export interface GetKlinesRequest {
  userId: string
  dataSourceInstanceId: string
  symbol: string
  interval: string
  query?: KlineQueryKind
  from?: number
  to?: number
  before?: number
  limit?: number
  mode?: KlineReadMode
  priority?: KlineRequestPriority
}

export interface CanonicalKline extends Kline {
  volume: number
  isFinal: boolean
}

export interface KlineSeriesRef {
  id: string
  dataSourceInstanceId: string
  providerKind: string
  identityKey: string | null
  symbol: string
  interval: string
}

export interface KlineFetchRange {
  from: number
  to: number
}
