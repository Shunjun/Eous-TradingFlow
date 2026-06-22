// ── 配置字段（前端据此动态渲染表单）──
export interface ConfigField {
  key: string
  label: string
  type: 'text' | 'password' | 'select' | 'number' | 'boolean'
  required: boolean
  placeholder?: string
  hint?: string
  options?: { label: string; value: string }[] // select 用
  optionsSource?: { source: 'provider' } // 由 provider 按字段动态提供选项
  defaultValue?: string | number | boolean
}

export interface ConfigFieldOption {
  label: string
  value: string
}

// ── 符号信息 ──
export interface SymbolInfo {
  symbol: string // provider 原生格式，如 "AAPL"、"0700.HK"
  name: string // 显示名 "Apple Inc."
  exchange?: string // 交易所，如 "NASDAQ"
  type?: string // "stock" | "crypto" | "forex" | "index" | "etf"
}

// ── 行情数据 ──
export interface Quote {
  symbol: string
  price: number
  change?: number
  changePercent?: number
  high?: number
  low?: number
  open?: number
  volume?: number
  timestamp: number // unix ms
}

export interface Kline {
  timestamp: number // unix ms
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export interface KlinesRequest {
  symbol: string
  interval: string
  from: number // unix ms
  to: number // unix ms
}

// ── Realtime data ──
export type RealtimeMode = 'stream' | 'poll'
export type RealtimeSubscribeMode = 'auto' | RealtimeMode

export interface RealtimeChannelCapabilities {
  /** Available realtime delivery modes. Poll is backed by getQuote/getKlines. */
  modes: RealtimeMode[]
  /** Provider-specific minimum poll interval. Server must enforce this floor. */
  minPollIntervalMs?: number
  /** Optional interval allowlist for kline realtime delivery. */
  supportedIntervals?: string[]
}

export interface RealtimeCapabilities {
  quote: RealtimeChannelCapabilities
  kline: RealtimeChannelCapabilities
}

export interface QuoteSubscribeRequest {
  symbol: string
  mode?: RealtimeSubscribeMode
  pollIntervalMs?: number
}

export interface KlineSubscribeRequest extends QuoteSubscribeRequest {
  interval: string
}

export interface RealtimeQuoteEvent {
  type: 'quote'
  symbol: string
  data: Quote
  source: RealtimeMode
  timestamp: number
}

export interface RealtimeKlineEvent {
  type: 'kline'
  symbol: string
  interval: string
  data: Kline
  isFinal?: boolean
  source: RealtimeMode
  timestamp: number
}

export type RealtimeUnsubscribe = () => void | Promise<void>

// ── Interval 定义 ──
export interface IntervalDef {
  /** 显示标签，如 "1m", "5m", "1h", "1d" */
  label: string
  /** 内部值，用于请求 */
  value: string
}

// ── Provider 接口 ──
export type DataSourceConfig = Record<string, string>

export interface DataSourceProvider<TConfig extends DataSourceConfig = DataSourceConfig> {
  id: string // 唯一标识，如 "yahoo-finance"
  name: string // 显示名 "Yahoo Finance"
  configSchema: ConfigField[] // 配置表单定义

  /** 返回该 provider 支持的时间周期列表 */
  getSupportedIntervals(config: TConfig): Promise<IntervalDef[]> | IntervalDef[]

  /**
   * 根据用户配置生成 provider 的唯一标识。
   * 例：CCXT exchange=binance → { displayName: "CCXT - Binance", key: "binance" }
   * 无需区分的 provider 返回 key="" 即可。
   */
  resolveIdentity(config: TConfig): { displayName: string; key: string }

  /** 返回配置字段的动态选项，例如 CCXT exchange 列表。 */
  getConfigFieldOptions?(fieldKey: string, query?: string): Promise<ConfigFieldOption[]>

  getDefaultSymbols(
    offset: number,
    limit: number,
    config: TConfig,
  ): Promise<{ symbols: SymbolInfo[]; total: number }>

  searchSymbols(query: string, config: TConfig): Promise<SymbolInfo[]>
  getQuote(symbol: string, config: TConfig): Promise<Quote>
  getKlines(request: KlinesRequest, config: TConfig): Promise<Kline[]>

  getRealtimeCapabilities?(config: TConfig): Promise<RealtimeCapabilities> | RealtimeCapabilities
  subscribeQuote?(
    request: QuoteSubscribeRequest,
    config: TConfig,
    emit: (event: RealtimeQuoteEvent) => void,
  ): Promise<RealtimeUnsubscribe> | RealtimeUnsubscribe
  subscribeKlines?(
    request: KlineSubscribeRequest,
    config: TConfig,
    emit: (event: RealtimeKlineEvent) => void,
  ): Promise<RealtimeUnsubscribe> | RealtimeUnsubscribe
}
