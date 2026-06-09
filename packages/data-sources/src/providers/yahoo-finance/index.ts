import type {
  DataSourceProvider,
  SymbolInfo,
  Quote,
  Kline,
  KlinesRequest,
  IntervalDef,
  ConfigField,
} from '../../types.js'
import { isNetworkError, isRateLimitError } from '../utils.js'

// ── Yahoo 支持的时间周期 ──
const SUPPORTED_INTERVALS: IntervalDef[] = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1h', value: '1h' },
  { label: '1d', value: '1d' },
  { label: '1w', value: '1w' },
]

// ── Yahoo interval 映射（value → Yahoo API interval）──
const INTERVAL_MAP: Record<string, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '1d': '1d',
  '1w': '1wk',
}

const TIMEOUT_MS = 10_000

// ── region → search query 偏好 ──
const REGION_SUFFIX: Record<string, string> = {
  HK: '.HK',
  CN: '.SS',
  JP: '.T',
  UK: '.L',
}

// ── 类型：search 响应 ──
interface YahooSearchResponse {
  quotes: Array<{
    symbol: string
    shortname?: string
    longname?: string
    exchange?: string
    quoteType?: string
  }>
}

// ── 类型：screener 响应 ──
interface YahooScreenerResponse {
  finance: {
    result: Array<{
      quotes: Array<{
        symbol: string
        shortName?: string
        longName?: string
        exchange?: string
        quoteType?: string
      }>
      total: number
    }>
  }
}

// ── 类型：chart 响应 ──
interface YahooChartResponse {
  chart: {
    result: Array<{
      meta: {
        regularMarketPrice?: number
        previousClose?: number
        regularMarketDayHigh?: number
        regularMarketDayLow?: number
        regularMarketOpen?: number
        regularMarketVolume?: number
        regularMarketTime?: number
        currency?: string
      }
      timestamp?: number[]
      indicators: {
        quote: Array<{
          open: Array<number | null>
          high: Array<number | null>
          low: Array<number | null>
          close: Array<number | null>
          volume: Array<number | null>
        }>
      }
    }> | null
    error?: { code: string; description: string }
  }
}

export class YahooFinanceProvider implements DataSourceProvider {
  readonly id = 'yahoo-finance'
  readonly name = 'Yahoo Finance'

  readonly configSchema: ConfigField[] = [
    {
      key: 'region',
      label: 'Market Region',
      type: 'select',
      required: true,
      defaultValue: 'US',
      options: [
        { label: 'United States', value: 'US' },
        { label: 'Hong Kong', value: 'HK' },
        { label: 'China (A-Shares)', value: 'CN' },
        { label: 'Japan', value: 'JP' },
        { label: 'United Kingdom', value: 'UK' },
        { label: 'Global', value: 'GLOBAL' },
      ],
    },
  ]

  getSupportedIntervals(): IntervalDef[] {
    return SUPPORTED_INTERVALS
  }

  resolveIdentity(_config: Record<string, string>): { displayName: string; key: string } {
    return { displayName: 'Yahoo Finance', key: '' }
  }

  async getDefaultSymbols(
    offset: number,
    limit: number,
    _config: Record<string, string>,
  ): Promise<{ symbols: SymbolInfo[]; total: number }> {
    const url = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=most_actives&start=${offset}&count=${limit}`

    try {
      const data = await this.fetchJson<YahooScreenerResponse>(url)
      const result = data.finance?.result?.[0]
      if (!result) return { symbols: [], total: 0 }

      return {
        symbols: result.quotes.map(
          (q): SymbolInfo => ({
            symbol: q.symbol,
            name: q.shortName || q.longName || q.symbol,
            exchange: q.exchange,
            type: this.mapQuoteType(q.quoteType),
          }),
        ),
        total: result.total,
      }
    } catch (e) {
      if (isNetworkError(e) || isRateLimitError(e)) {
        return { symbols: [], total: 0 }
      }
      throw e
    }
  }

  async searchSymbols(query: string, config: Record<string, string>): Promise<SymbolInfo[]> {
    const region = config['region'] ?? 'US'
    const searchQuery =
      region !== 'US' && region !== 'GLOBAL' && REGION_SUFFIX[region]
        ? `${query} ${REGION_SUFFIX[region]}`
        : query

    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(searchQuery)}&quotesCount=10&lang=en-US`

    try {
      const data = await this.fetchJson<YahooSearchResponse>(url)
      return data.quotes.map(
        (q): SymbolInfo => ({
          symbol: q.symbol,
          name: q.shortname || q.longname || q.symbol,
          exchange: q.exchange,
          type: this.mapQuoteType(q.quoteType),
        }),
      )
    } catch (e) {
      if (isNetworkError(e) || isRateLimitError(e)) {
        return []
      }
      throw e
    }
  }

  async getQuote(symbol: string, _config: Record<string, string>): Promise<Quote> {
    // 拉最近 2 根日 K 线用于计算 change
    const now = Math.floor(Date.now() / 1000)
    const from = now - 7 * 86400 // 7 天前，保证至少有 2 根日线
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&period1=${from}&period2=${now}`

    try {
      const data = await this.fetchJson<YahooChartResponse>(url)
      const result = data.chart.result
      if (!result || result.length === 0) {
        throw new Error(`No data returned for symbol: ${symbol}`)
      }

      const { meta, indicators } = result[0]
      const quote = indicators.quote[0]
      const closes = quote.close.filter((v): v is number => v != null)

      const price = meta.regularMarketPrice ?? closes[closes.length - 1] ?? 0
      const previousClose =
        meta.previousClose ?? (closes.length >= 2 ? closes[closes.length - 2] : undefined)

      return {
        symbol,
        price,
        change: previousClose != null ? Number((price - previousClose).toFixed(4)) : undefined,
        changePercent:
          previousClose != null && previousClose !== 0
            ? Number((((price - previousClose) / previousClose) * 100).toFixed(2))
            : undefined,
        high: meta.regularMarketDayHigh,
        low: meta.regularMarketDayLow,
        open: meta.regularMarketOpen,
        volume: meta.regularMarketVolume,
        timestamp: (meta.regularMarketTime ?? Math.floor(Date.now() / 1000)) * 1000,
      }
    } catch (e) {
      if (isNetworkError(e) || isRateLimitError(e)) {
        throw new Error(`Failed to fetch quote for ${symbol}: ${e instanceof Error ? e.message : String(e)}`)
      }
      throw e
    }
  }

  async getKlines(request: KlinesRequest, _config: Record<string, string>): Promise<Kline[]> {
    const interval = INTERVAL_MAP[request.interval] ?? '1d'
    const period1 = Math.floor(request.from / 1000) // ms → s
    const period2 = Math.floor(request.to / 1000)

    console.log('[yahoo getKlines]', { symbol: request.symbol, interval, period1, period2 })

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(request.symbol)}?interval=${interval}&period1=${period1}&period2=${period2}`

    try {
      const data = await this.fetchJson<YahooChartResponse>(url)
      const result = data.chart.result
      if (!result || result.length === 0) {
        console.log('[yahoo getKlines] empty result', { hasResult: !!data.chart.result, error: data.chart.error })
        return []
      }

      const { timestamp: timestamps, indicators } = result[0]
      if (!timestamps || timestamps.length === 0) return []

      const quote = indicators.quote[0]
      const klines: Kline[] = []

      for (let i = 0; i < timestamps.length; i++) {
        const open = quote.open[i]
        const high = quote.high[i]
        const low = quote.low[i]
        const close = quote.close[i]
        const volume = quote.volume[i]

        // 跳过空数据行
        if (open == null || close == null) continue

        klines.push({
          timestamp: timestamps[i] * 1000, // s → ms
          open,
          high: high ?? open,
          low: low ?? open,
          close,
          volume: volume ?? undefined,
        })
      }

      console.log('[yahoo getKlines] response', { count: klines.length, sample: klines[0] })
      return klines
    } catch (e: any) {
      console.error('[yahoo getKlines] error', { message: e?.message })
      if (isNetworkError(e) || isRateLimitError(e)) {
        return []
      }
      throw e
    }
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          Accept: 'application/json',
        },
      })
      if (!res.ok) {
        throw new Error(`Yahoo Finance API error: ${res.status} ${res.statusText}`)
      }
      return (await res.json()) as T
    } finally {
      clearTimeout(timer)
    }
  }

  private mapQuoteType(yahooType?: string): string | undefined {
    switch (yahooType?.toUpperCase()) {
      case 'EQUITY':
        return 'stock'
      case 'ETF':
        return 'etf'
      case 'CRYPTOCURRENCY':
        return 'crypto'
      case 'INDEX':
        return 'index'
      case 'CURRENCY':
        return 'forex'
      default:
        return yahooType?.toLowerCase()
    }
  }
}
