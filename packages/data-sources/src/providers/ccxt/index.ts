import ccxt from 'ccxt'
import type { Exchange, OHLCV } from 'ccxt'
import type {
  DataSourceProvider,
  SymbolInfo,
  Quote,
  Kline,
  KlinesRequest,
} from '../../types.js'

// ── interval 映射到 CCXT timeframe ──
const INTERVAL_MAP: Record<KlinesRequest['interval'], string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d',
  '1w': '1w',
}

const TIMEOUT_MS = 15_000

function getExchange(exchangeId: string): Exchange {
  const ExClass = (ccxt as unknown as Record<string, unknown>)[
    exchangeId
  ] as new (opts?: Record<string, unknown>) => Exchange
  if (!ExClass) {
    throw new Error(`Unsupported exchange: ${exchangeId}`)
  }
  return new ExClass({ timeout: TIMEOUT_MS })
}

function estimateLimit(request: KlinesRequest, timeframe: string): number {
  const msPerBar: Record<string, number> = {
    '1m': 60_000,
    '5m': 300_000,
    '15m': 900_000,
    '30m': 1_800_000,
    '1h': 3_600_000,
    '4h': 14_400_000,
    '1d': 86_400_000,
    '1w': 604_800_000,
  }
  const ms = msPerBar[timeframe] ?? 86_400_000
  const count = Math.ceil((request.to - request.from) / ms)
  return Math.min(Math.max(count, 1), 1000)
}

export const CCXTProvider: DataSourceProvider = {
  id: 'ccxt',
  name: 'CCXT',
  configSchema: [
    {
      key: 'exchange',
      label: 'Exchange',
      type: 'select',
      required: true,
      options: ccxt.exchanges.map((id) => ({ label: id, value: id })),
      hint: '100+ supported exchanges',
    },
  ],

  resolveIdentity(config) {
    const ex = config['exchange'] || 'unknown'
    return { displayName: `CCXT - ${ex}`, key: ex }
  },

  async searchSymbols(query, config) {
    try {
      const ex = getExchange(config['exchange']!)
      const markets = await ex.fetchMarkets()
      const q = query.toUpperCase()
      const results: SymbolInfo[] = []

      for (const market of markets) {
        if (results.length >= 20) break
        const symbol = market?.symbol ?? ''
        if (symbol.toUpperCase().includes(q)) {
          results.push({
            symbol,
            name: symbol,
            type: 'crypto',
          })
        }
      }

      return results
    } catch {
      return []
    }
  },

  async getQuote(symbol, config) {
    const ex = getExchange(config['exchange']!)
    const ticker = await ex.fetchTicker(symbol)

    return {
      symbol,
      price: ticker.last ?? 0,
      change: ticker.change ?? undefined,
      changePercent: ticker.percentage ?? undefined,
      high: ticker.high ?? undefined,
      low: ticker.low ?? undefined,
      open: ticker.open ?? undefined,
      volume: ticker.baseVolume ?? undefined,
      timestamp: ticker.timestamp ?? Date.now(),
    }
  },

  async getKlines(request: KlinesRequest, config) {
    try {
      const ex = getExchange(config['exchange']!)
      const timeframe = INTERVAL_MAP[request.interval]
      const since = request.from
      const limit = estimateLimit(request, timeframe)

      const ohlcv = await ex.fetchOHLCV(
        request.symbol,
        timeframe,
        since,
        limit,
      )

      return ohlcv.map(
        (bar: OHLCV): Kline => ({
          timestamp: bar[0] as number,
          open: bar[1] as number,
          high: bar[2] as number,
          low: bar[3] as number,
          close: bar[4] as number,
          volume: bar[5] as number | undefined,
        }),
      )
    } catch {
      return []
    }
  },
}
