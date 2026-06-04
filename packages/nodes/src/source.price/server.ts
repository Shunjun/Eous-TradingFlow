import type { Quote } from '@eous/types'
import type { ExecuteContext } from '../types'
import type { ExecuteInput, ExecuteOutput } from './types'

const MOCK_QUOTES: Record<string, Quote> = {
  AAPL: {
    symbol: 'AAPL',
    price: 198.45,
    change: 2.31,
    changePercent: 1.18,
    volume: 52_430_000,
    high: 200.12,
    low: 195.8,
    timestamp: Date.now(),
  },
  TSLA: {
    symbol: 'TSLA',
    price: 245.67,
    change: -3.82,
    changePercent: -1.53,
    volume: 78_210_000,
    high: 250.3,
    low: 243.15,
    timestamp: Date.now(),
  },
  BTCUSD: {
    symbol: 'BTCUSD',
    price: 67_842.5,
    change: 1_204.3,
    changePercent: 1.81,
    volume: 28_450_000_000,
    high: 68_500.0,
    low: 66_100.0,
    timestamp: Date.now(),
  },
}

function generateMockQuote(symbol: string): Quote {
  const basePrice = 100 + Math.random() * 200
  const change = (Math.random() - 0.5) * 10
  return {
    symbol,
    price: Number(basePrice.toFixed(2)),
    change: Number(change.toFixed(2)),
    changePercent: Number(((change / basePrice) * 100).toFixed(2)),
    volume: Math.floor(Math.random() * 50_000_000),
    high: Number((basePrice + Math.abs(change)).toFixed(2)),
    low: Number((basePrice - Math.abs(change)).toFixed(2)),
    timestamp: Date.now(),
  }
}

export async function execute(input: ExecuteInput, _ctx: ExecuteContext): Promise<ExecuteOutput> {
  const symbol = input.symbol.toUpperCase()
  const quote = MOCK_QUOTES[symbol] ?? generateMockQuote(symbol)

  return {
    price: quote.price,
    change: quote.change,
    changePercent: quote.changePercent,
    volume: quote.volume,
    timestamp: quote.timestamp,
  }
}
