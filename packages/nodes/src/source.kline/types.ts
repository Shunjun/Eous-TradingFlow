import type { OHLCVBar } from '@eous/types'

interface ExecuteInput {
  symbol: string
  interval: string
  limit: number
}

interface ExecuteOutput {
  bars: OHLCVBar[]
  symbol: string
  interval: string
}

export type { ExecuteInput, ExecuteOutput }
