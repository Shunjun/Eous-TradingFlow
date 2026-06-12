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
  ConfigField,
} from '../../types.js'
import { parseIntervalMs } from '../../utils.js'
import { isNetworkError, isRateLimitError } from '../utils.js'

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

export class CCXTProvider implements DataSourceProvider {
  readonly id = 'ccxt'
  readonly name = 'CCXT'

  readonly configSchema: ConfigField[] = [
    {
      key: 'exchange',
      label: 'Exchange',
      type: 'select',
      required: true,
      defaultValue: 'binance',
      placeholder: 'binance',
      optionsSource: { source: 'provider' },
      hint: '100+ supported exchanges',
    },
  ]

  getSupportedIntervals(): IntervalDef[] {
    return SUPPORTED_INTERVALS
  }

  resolveIdentity(config: Record<string, string>): { displayName: string; key: string } {
    const ex = config['exchange'] || 'unknown'
    return { displayName: `CCXT - ${ex}`, key: ex }
  }

  async getConfigFieldOptions(fieldKey: string, query?: string) {
    if (fieldKey !== 'exchange') return []

    const q = query?.trim().toLowerCase()
    const exchanges = q
      ? ccxt.exchanges.filter((id) => id.toLowerCase().includes(q))
      : ccxt.exchanges
    return exchanges.map((id) => ({ label: id, value: id }))
  }

  async getDefaultSymbols(
    offset: number,
    limit: number,
    config: Record<string, string>,
  ): Promise<{ symbols: SymbolInfo[]; total: number }> {
    const exchangeId = config['exchange']
    if (!exchangeId) {
      throw new Error('config.exchange is required')
    }

    const ex = this.getExchange(exchangeId)

    try {
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
    } catch (e) {
      if (isNetworkError(e) || isRateLimitError(e)) {
        return { symbols: [], total: 0 }
      }
      throw e
    }
  }

  async searchSymbols(query: string, config: Record<string, string>): Promise<SymbolInfo[]> {
    const exchangeId = config['exchange']
    if (!exchangeId) {
      throw new Error('config.exchange is required')
    }

    const ex = this.getExchange(exchangeId)

    try {
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
    } catch (e) {
      if (isNetworkError(e) || isRateLimitError(e)) {
        return []
      }
      throw e
    }
  }

  async getQuote(symbol: string, config: Record<string, string>): Promise<Quote> {
    const exchangeId = config['exchange']
    if (!exchangeId) {
      throw new Error('config.exchange is required')
    }

    const ex = this.getExchange(exchangeId)
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
  }

  async getKlines(request: KlinesRequest, config: Record<string, string>): Promise<Kline[]> {
    const exchangeId = config['exchange']
    if (!exchangeId) {
      console.error('[ccxt getKlines] exchange missing', { config })
      throw new Error('config.exchange is required')
    }

    console.log('[ccxt getKlines]', { request, configKeys: Object.keys(config) })

    const ex = this.getExchange(exchangeId)

    try {
      const timeframe = INTERVAL_MAP[request.interval]
      const since = request.from
      const limit = this.estimateLimit(request, timeframe)

      console.log('[ccxt getKlines] fetchOHLCV params', {
        symbol: request.symbol,
        timeframe,
        since,
        limit,
      })

      const ohlcv = await ex.fetchOHLCV(request.symbol, timeframe, since, limit)

      console.log('[ccxt getKlines] response', { count: ohlcv.length, sample: ohlcv[0] })

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
    } catch (e: any) {
      console.error('[ccxt getKlines] error', {
        message: e?.message,
        code: e?.code,
        stack: e?.stack?.split('\n').slice(0, 5).join('\n'),
      })
      if (isNetworkError(e) || isRateLimitError(e)) {
        return []
      }
      throw e
    }
  }

  private getExchange(exchangeId: string): Exchange {
    const ExClass = (ccxt as unknown as Record<string, unknown>)[exchangeId] as new (
      opts?: Record<string, unknown>,
    ) => Exchange
    if (!ExClass) {
      throw new Error(`Unsupported exchange: ${exchangeId}`)
    }
    const opts: Record<string, unknown> = { timeout: TIMEOUT_MS }

    const proxyUrl = this.resolveProxy()
    if (proxyUrl) {
      opts.agent = new HttpsProxyAgent(proxyUrl)
    }

    return new ExClass(opts)
  }

  private estimateLimit(request: KlinesRequest, timeframe: string): number {
    const ms = parseIntervalMs(timeframe)
    const count = Math.ceil((request.to - request.from) / ms)
    return Math.min(Math.max(count, 1), 1000)
  }

  private resolveProxy(): string | undefined {
    return (
      process.env.HTTPS_PROXY ||
      process.env.https_proxy ||
      process.env.HTTP_PROXY ||
      process.env.http_proxy ||
      process.env.ALL_PROXY ||
      process.env.all_proxy ||
      undefined
    )
  }
}
