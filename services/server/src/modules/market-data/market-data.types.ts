import type { Kline } from '@eous/data-sources'

export type KlineReadMode = 'closed-only' | 'include-live'
export type KlineRequestPriority = 'interactive' | 'background' | 'workflow'

export interface GetKlinesRequest {
  userId: string
  dataSourceInstanceId: string
  symbol: string
  interval: string
  from?: number
  to?: number
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
