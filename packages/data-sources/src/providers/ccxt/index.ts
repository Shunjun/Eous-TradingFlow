import ccxt from 'ccxt'
import type { Exchange, Market, OHLCV } from 'ccxt'
import type {
  DataSourceProvider,
  SymbolInfo,
  Quote,
  Kline,
  KlinesRequest,
  IntervalDef,
  ConfigField,
  RealtimeCapabilities,
  KlineSubscribeRequest,
  RealtimeKlineEvent,
  RealtimeUnsubscribe,
  DataSourceProviderOptions,
  DataSourceSettings,
} from '../../types.js'
import { parseIntervalMs } from '../../utils.js'
import { isNetworkError, isRateLimitError } from '../utils.js'

type CCXTSettings = DataSourceSettings & {
  exchange: string
}

type IntervalPlan =
  | { value: string; label: string; source: 'native'; timeframe: string }
  | { value: string; label: string; source: 'derived'; baseInterval: string; factor: 2 }

type CCXTNamespace = typeof ccxt & {
  pro?: Record<string, new (opts?: Record<string, unknown>) => StreamingExchange>
}

type StreamingExchange = Exchange & {
  loadProxyModules?(): Promise<unknown>
  watchOHLCV(
    symbol: string,
    timeframe?: string,
    since?: number,
    limit?: number,
    params?: Record<string, unknown>,
  ): Promise<OHLCV[]>
  unWatchOHLCV?(
    symbol: string,
    timeframe?: string,
    params?: Record<string, unknown>,
  ): Promise<unknown>
}

const TIMEOUT_MS = 15_000

function isSupportedMarket(market: Market | undefined): market is Market {
  if (!market?.symbol) return false
  return market.active !== false && market.spot === true
}

function toProviderError(action: string, e: any): Error {
  const message = e?.message ? String(e.message) : String(e)
  if (isRateLimitError(e)) {
    return new Error(`CCXT ${action} failed: exchange rate limit exceeded. ${message}`)
  }
  if (isNetworkError(e)) {
    return new Error(`CCXT ${action} failed: network request failed. ${message}`)
  }
  return e instanceof Error ? e : new Error(message)
}

function normalizeInterval(interval: string): string | null {
  const match = interval.match(/^(\d+)([mhdw])$/)
  if (!match) return null

  const value = Number(match[1])
  const unit = match[2]
  if (!Number.isFinite(value) || value <= 0) return null

  if (unit === 'm' && value % 60 === 0) return `${value / 60}h`
  if (unit === 'h' && value % 24 === 0) return `${value / 24}d`
  if (unit === 'd' && value % 7 === 0) return `${value / 7}w`
  return `${value}${unit}`
}

function doubleInterval(interval: string): string | null {
  const match = interval.match(/^(\d+)([mhdw])$/)
  if (!match) return null
  return normalizeInterval(`${Number(match[1]) * 2}${match[2]}`)
}

function sortIntervals(a: IntervalPlan, b: IntervalPlan): number {
  return parseIntervalMs(a.value) - parseIntervalMs(b.value)
}

function toKline(bar: OHLCV): Kline {
  return {
    timestamp: bar[0] as number,
    open: bar[1] as number,
    high: bar[2] as number,
    low: bar[3] as number,
    close: bar[4] as number,
    volume: bar[5] as number | undefined,
  }
}

function aggregateKlines(klines: Kline[], interval: string): Kline[] {
  const intervalMs = parseIntervalMs(interval)
  const buckets = new Map<number, Kline[]>()

  for (const kline of klines) {
    const bucketTime = Math.floor(kline.timestamp / intervalMs) * intervalMs
    const bucket = buckets.get(bucketTime)
    if (bucket) {
      bucket.push(kline)
    } else {
      buckets.set(bucketTime, [kline])
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([timestamp, bucket]) => {
      const sorted = bucket.sort((a, b) => a.timestamp - b.timestamp)
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      return {
        timestamp,
        open: first.open,
        high: Math.max(...sorted.map((item) => item.high)),
        low: Math.min(...sorted.map((item) => item.low)),
        close: last.close,
        volume: sorted.reduce((sum, item) => (item.volume == null ? sum : sum + item.volume), 0),
      }
    })
}

function klineSignature(kline: Kline): string {
  return JSON.stringify([
    kline.timestamp,
    kline.open,
    kline.high,
    kline.low,
    kline.close,
    kline.volume,
  ])
}

function latestKline(klines: Kline[]): Kline | null {
  if (klines.length === 0) return null
  return klines.reduce((latest, item) => (item.timestamp > latest.timestamp ? item : latest))
}

export class CCXTProvider implements DataSourceProvider<CCXTSettings> {
  readonly id = 'ccxt'
  readonly name = 'CCXT'
  private readonly exchangeCache = new Map<string, Exchange>()
  private readonly streamingExchangeCache = new Map<string, StreamingExchange>()
  private readonly intervalPlanCache = new Map<string, IntervalPlan[]>()

  constructor(private readonly options: DataSourceProviderOptions = {}) {}

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

  async getSupportedIntervals(settings: CCXTSettings): Promise<IntervalDef[]> {
    const plans = await this.getIntervalPlans(settings.exchange)
    return plans.map((plan) => ({ label: plan.label, value: plan.value }))
  }

  async getRealtimeCapabilities(settings: CCXTSettings): Promise<RealtimeCapabilities> {
    const intervals = await this.getSupportedIntervals(settings)
    const supportsKlineStream = this.supportsKlineStream(settings.exchange)
    return {
      quote: { modes: ['poll'], minPollIntervalMs: 10_000 },
      kline: {
        modes: supportsKlineStream ? ['stream', 'poll'] : ['poll'],
        minPollIntervalMs: 10_000,
        supportedIntervals: intervals.map((item) => item.value),
      },
    }
  }

  resolveIdentity(settings: CCXTSettings): { displayName: string; key: string } {
    return { displayName: `CCXT - ${settings.exchange}`, key: settings.exchange }
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
    settings: CCXTSettings,
  ): Promise<{ symbols: SymbolInfo[]; total: number }> {
    const ex = this.getExchange(settings.exchange)

    try {
      const markets = (await ex.fetchMarkets()).filter(isSupportedMarket)
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
      throw toProviderError('fetchMarkets', e)
    }
  }

  async searchSymbols(query: string, settings: CCXTSettings): Promise<SymbolInfo[]> {
    const ex = this.getExchange(settings.exchange)

    try {
      const markets = (await ex.fetchMarkets()).filter(isSupportedMarket)
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
      throw toProviderError('searchSymbols', e)
    }
  }

  async getQuote(symbol: string, settings: CCXTSettings): Promise<Quote> {
    const ex = this.getExchange(settings.exchange)
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

  async getKlines(request: KlinesRequest, settings: CCXTSettings): Promise<Kline[]> {
    const ex = this.getExchange(settings.exchange)

    try {
      const plan = await this.getIntervalPlan(settings.exchange, request.interval)
      if (!plan) {
        throw new Error(`Unsupported interval for ${settings.exchange}: ${request.interval}`)
      }

      const timeframe = plan.source === 'native' ? plan.timeframe : plan.baseInterval
      const since = request.from
      const limit = this.estimateLimit(
        request,
        timeframe,
        plan.source === 'derived' ? plan.factor : 1,
      )

      const ohlcv = await ex.fetchOHLCV(request.symbol, timeframe, since, limit)
      const klines = ohlcv.map(toKline)

      return plan.source === 'derived' ? aggregateKlines(klines, request.interval) : klines
    } catch (e: any) {
      console.error('[ccxt getKlines] error', {
        message: e?.message,
        code: e?.code,
        stack: e?.stack?.split('\n').slice(0, 5).join('\n'),
      })
      throw toProviderError('fetchOHLCV', e)
    }
  }

  async subscribeKlines(
    request: KlineSubscribeRequest,
    settings: CCXTSettings,
    emit: (event: RealtimeKlineEvent) => void,
  ): Promise<RealtimeUnsubscribe> {
    const ex = this.getStreamingExchange(settings.exchange)
    const plan = await this.getIntervalPlan(settings.exchange, request.interval)
    if (!plan) {
      throw new Error(`Unsupported interval for ${settings.exchange}: ${request.interval}`)
    }

    const timeframe = plan.source === 'native' ? plan.timeframe : plan.baseInterval
    const intervalMs = parseIntervalMs(request.interval)
    let stopped = false
    let lastSignature: string | null = null

    const publish = (ohlcv: OHLCV[]) => {
      const klines = ohlcv.map(toKline)
      const latest =
        plan.source === 'derived'
          ? latestKline(aggregateKlines(klines, request.interval))
          : latestKline(klines)
      if (!latest) return

      const signature = klineSignature(latest)
      if (signature === lastSignature) return
      lastSignature = signature

      const now = Date.now()
      emit({
        type: 'kline',
        symbol: request.symbol,
        interval: request.interval,
        data: latest,
        isFinal: latest.timestamp + intervalMs <= now,
        source: 'stream',
        timestamp: now,
      })
    }

    try {
      await ex.loadProxyModules?.()
      publish(await ex.watchOHLCV(request.symbol, timeframe))
    } catch (e) {
      throw toProviderError('watchOHLCV', e)
    }

    void (async () => {
      while (!stopped) {
        try {
          publish(await ex.watchOHLCV(request.symbol, timeframe))
        } catch (e) {
          if (stopped) return
          console.error('[ccxt subscribeKlines] stream failed', {
            exchange: settings.exchange,
            symbol: request.symbol,
            interval: request.interval,
            error: e instanceof Error ? e.message : String(e),
          })
          return
        }
      }
    })()

    return async () => {
      stopped = true
      if (ex.unWatchOHLCV) {
        await ex.unWatchOHLCV(request.symbol, timeframe).catch(() => undefined)
      }
    }
  }

  private getExchange(exchangeId: string): Exchange {
    const proxy = this.resolveProxy()
    const cacheKey = `${exchangeId}:${proxy.cacheKey}`
    const cached = this.exchangeCache.get(cacheKey)
    if (cached) return cached

    const ExClass = (ccxt as unknown as Record<string, unknown>)[exchangeId] as new (
      opts?: Record<string, unknown>,
    ) => Exchange
    if (!ExClass) {
      throw new Error(`Unsupported exchange: ${exchangeId}`)
    }
    const opts = this.getExchangeOptions(exchangeId, proxy.options)

    const exchange = new ExClass(opts)
    this.exchangeCache.set(cacheKey, exchange)
    return exchange
  }

  private getStreamingExchange(exchangeId: string): StreamingExchange {
    const proxy = this.resolveProxy()
    const cacheKey = `${exchangeId}:${proxy.cacheKey}`
    const cached = this.streamingExchangeCache.get(cacheKey)
    if (cached) return cached

    const ExClass = (ccxt as CCXTNamespace).pro?.[exchangeId]
    if (!ExClass) {
      throw new Error(`Exchange does not expose CCXT websocket support: ${exchangeId}`)
    }

    const opts = this.getExchangeOptions(exchangeId, proxy.options)

    const exchange = new ExClass(opts)
    if (exchange.has?.watchOHLCV !== true) {
      throw new Error(`Exchange does not support realtime OHLCV stream: ${exchangeId}`)
    }

    this.streamingExchangeCache.set(cacheKey, exchange)
    return exchange
  }

  private supportsKlineStream(exchangeId: string): boolean {
    const ExClass = (ccxt as CCXTNamespace).pro?.[exchangeId]

    if (!ExClass) return false

    const exchange = new ExClass({ timeout: TIMEOUT_MS })
    return exchange.has?.watchOHLCV === true && typeof exchange.watchOHLCV === 'function'
  }

  private async getIntervalPlan(
    exchangeId: string,
    interval: string,
  ): Promise<IntervalPlan | undefined> {
    const normalized = normalizeInterval(interval)
    if (!normalized) return undefined
    const plans = await this.getIntervalPlans(exchangeId)
    return plans.find((plan) => plan.value === normalized)
  }

  private async getIntervalPlans(exchangeId: string): Promise<IntervalPlan[]> {
    const cached = this.intervalPlanCache.get(exchangeId)
    if (cached) return cached

    const ex = this.getExchange(exchangeId)
    if (!ex.timeframes || Object.keys(ex.timeframes).length === 0) {
      await ex.loadMarkets()
    }

    const nativeTimeframes = new Map<string, string>()
    for (const timeframe of Object.keys(ex.timeframes ?? {})) {
      const value = normalizeInterval(timeframe)
      if (value && !nativeTimeframes.has(value)) {
        nativeTimeframes.set(value, timeframe)
      }
    }

    if (nativeTimeframes.size === 0) {
      throw new Error(`Exchange does not expose OHLCV timeframes: ${exchangeId}`)
    }

    const nativeValues = Array.from(nativeTimeframes.keys())
    const nativeSet = new Set(nativeValues)
    const plans = new Map<string, IntervalPlan>()

    for (const [value, timeframe] of nativeTimeframes) {
      plans.set(value, { label: value, value, source: 'native', timeframe })
    }

    for (const value of nativeValues) {
      const doubled = doubleInterval(value)
      if (!doubled || nativeSet.has(doubled) || plans.has(doubled)) continue
      plans.set(doubled, {
        label: doubled,
        value: doubled,
        source: 'derived',
        baseInterval: value,
        factor: 2,
      })
    }

    const result = Array.from(plans.values()).sort(sortIntervals)
    this.intervalPlanCache.set(exchangeId, result)
    return result
  }

  private estimateLimit(request: KlinesRequest, timeframe: string, factor = 1): number {
    const ms = parseIntervalMs(timeframe)
    const count = Math.ceil((request.to - request.from) / ms) * factor
    return Math.min(Math.max(count, 1), 1000)
  }

  private resolveProxy(): { cacheKey: string; options: Record<string, string> } {
    const proxy = this.options.proxyUrl?.trim()
    if (!proxy) return { cacheKey: '', options: {} }

    if (/^socks/i.test(proxy)) {
      return {
        cacheKey: `socks:${proxy}`,
        options: {
          socksProxy: proxy,
          wsSocksProxy: proxy,
        },
      }
    }

    return {
      cacheKey: `http:${proxy}`,
      options: {
        httpsProxy: proxy,
        wssProxy: proxy,
      },
    }
  }

  private getExchangeOptions(
    exchangeId: string,
    proxyOptions: Record<string, string>,
  ): Record<string, unknown> {
    const options: Record<string, unknown> = { timeout: TIMEOUT_MS, ...proxyOptions }

    if (exchangeId === 'binance') {
      options.urls = {
        api: {
          ws: {
            spot: 'wss://stream.binance.com/ws',
            margin: 'wss://stream.binance.com/ws',
          },
        },
      }
    }

    return options
  }
}
