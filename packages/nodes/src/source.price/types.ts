export interface ExecuteInput {
  symbol: string
}

export interface ExecuteOutput {
  price: number
  change: number
  changePercent: number
  volume: number
  timestamp: number
}
