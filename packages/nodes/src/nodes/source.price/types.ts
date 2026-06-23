export interface ExecuteInput {
  dataSourceInstanceId: string
  symbol: string
  [key: string]: unknown
}

export interface ExecuteOutput {
  price: number
  change: number
  changePercent: number
  volume: number
  timestamp: number
}
