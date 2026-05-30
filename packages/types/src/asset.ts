export type AssetType = 'stock' | 'crypto' | 'forex' | 'etf' | 'index'

export interface AssetRef {
  symbol: string
  type: AssetType
  exchange?: string
  name?: string
}
