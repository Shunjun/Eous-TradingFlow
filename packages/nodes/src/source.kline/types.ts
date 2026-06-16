import type { OHLCVBar } from '@eous/api-client'

interface ExecuteInput {
  dataSourceInstanceId: string
  symbol: string
  interval: string
  limit: number
  [key: string]: unknown
}

interface ExecuteOutput {
  bars: OHLCVBar[]
  symbol: string
  interval: string
}

export type { ExecuteInput, ExecuteOutput }
