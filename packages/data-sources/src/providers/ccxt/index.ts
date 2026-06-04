import ccxt from 'ccxt'
import type { Exchange, OHLCV } from 'ccxt'
import { HttpsProxyAgent } from 'https-proxy-agent'
import type {
  DataSourceProvider,
  SymbolInfo,
  Quote,
  Kline,
  KlinesRequest,
  IntervalDef,
} from '../../types.js'
import { parseIntervalMs } from '../../utils.js'

// ── CCXT 支持的时间周期 ──
const SUPPORTED_INTERVALS: IntervalDef[] = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: '1d', value: '1d' },
  { label: '1w', value: '1w' },
]

// ── interval 映射到 CCXT timeframe ──
const INTERVAL_MAP: Record<string, string> = {
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

function getExchange(exchangeId: string, proxyUrl?: string): Exchange {
  const ExClass = (ccxt as unknown as Record<string, unknown>)[exchangeId] as new (
    opts?: Record<string, unknown>,
  ) => Exchange
  if (!ExClass) {
    throw new Error(`Unsupported exchange: ${exchangeId}`)
  }
  const opts: Record<string, unknown> = { timeout: TIMEOUT_MS }

  if (proxyUrl) {
    opts.agent = new HttpsProxyAgent(proxyUrl)
  }

  return new ExClass(opts)
}

function estimateLimit(request: KlinesRequest, timeframe: string): number {
  const ms = parseIntervalMs(timeframe)
  const count = Math.ceil((request.to - request.from) / ms)
  return Math.min(Math.max(count, 1), 1000)
}

function resolveProxy(config: Record<string, string>): string | undefined {
  return (
    config['proxy'] ||
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    process.env.ALL_PROXY ||
    process.env.all_proxy ||
    undefined
  )
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
    {
      key: 'proxy',
      label: 'Proxy URL',
      type: 'text',
      required: false,
      hint: 'SOCKS5/HTTP proxy, e.g. socks5://127.0.0.1:1080',
    },
  ],

  getSupportedIntervals() {
    return SUPPORTED_INTERVALS
  },

  resolveIdentity(config) {
    const ex = config['exchange'] || 'unknown'
    return { displayName: `CCXT - ${ex}`, key: ex }
  },

  async getDefaultSymbols(offset, limit, config) {
    try {
      const ex = getExchange(config['exchange']!, resolveProxy(config))
      const markets = await ex.fetchMarkets()
      const total = markets.length
      const sliced = markets.slice(offset, offset + limit)
      return {
        symbols: sliced.map(
          (m): SymbolInfo => ({
            symbol: m?.symbol ?? '',
            name: m?.symbol ?? '',
            type: 'crypto',
          }),
        ),
        total,
      }
    } catch {
      return { symbols: [], total: 0 }
    }
  },

  async searchSymbols(query, config) {
    try {
      const ex = getExchange(config['exchange']!, resolveProxy(config))
      const markets = await ex.fetchMarkets()
      const q = query.toUpperCase()
      const results: SymbolInfo[] = []

      for (const market of markets) {
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
    const ex = getExchange(config['exchange']!, resolveProxy(config))
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
      const ex = getExchange(config['exchange']!, resolveProxy(config))
      const timeframe = INTERVAL_MAP[request.interval]
      const since = request.from
      const limit = estimateLimit(request, timeframe)

      const ohlcv = await ex.fetchOHLCV(request.symbol, timeframe, since, limit)

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
