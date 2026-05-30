import type { AssetType } from './asset.js'

export interface OHLCVBar {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface Quote {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  high: number
  low: number
  timestamp: number
}

export type KlineInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w'

export interface MarketDataProvider {
  name: string
  supportedAssetTypes: AssetType[]
  getQuote(symbol: string): Promise<Quote>
  getKlines(params: {
    symbol: string
    interval: KlineInterval
    limit: number
    endTime?: number
  }): Promise<OHLCVBar[]>
}

export interface NewsArticle {
  id: string
  title: string
  summary: string
  content?: string
  url: string
  source: string
  publishedAt: string
  language: string
  relatedSymbols?: string[]
}

export interface NewsProvider {
  name: string
  search(params: {
    query: string
    sources?: string[]
    language?: string
    maxResults: number
    fromDate?: string
  }): Promise<NewsArticle[]>
}
