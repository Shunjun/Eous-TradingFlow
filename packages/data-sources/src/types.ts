// ── 配置字段（前端据此动态渲染表单）──
export interface ConfigField {
  key: string
  label: string
  type: 'text' | 'password' | 'select' | 'number' | 'boolean'
  required: boolean
  placeholder?: string
  hint?: string
  options?: { label: string; value: string }[] // select 用
  defaultValue?: string | number | boolean
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

// ── Interval 定义 ──
export interface IntervalDef {
  /** 显示标签，如 "1m", "5m", "1h", "1d" */
  label: string
  /** 内部值，用于请求 */
  value: string
}

// ── Provider 接口 ──
export interface DataSourceProvider {
  id: string // 唯一标识，如 "yahoo-finance"
  name: string // 显示名 "Yahoo Finance"
  configSchema: ConfigField[] // 配置表单定义

  /** 返回该 provider 支持的时间周期列表 */
  getSupportedIntervals(): IntervalDef[]

  /**
   * 根据用户配置生成 provider 的唯一标识。
   * 例：CCXT exchange=binance → { displayName: "CCXT - Binance", key: "binance" }
   * 无需区分的 provider 返回 key="" 即可。
   */
  resolveIdentity(
    config: Record<string, string>,
  ): { displayName: string; key: string }

  searchSymbols(
    query: string,
    config: Record<string, string>,
  ): Promise<SymbolInfo[]>
  getQuote(
    symbol: string,
    config: Record<string, string>,
  ): Promise<Quote>
  getKlines(
    request: KlinesRequest,
    config: Record<string, string>,
  ): Promise<Kline[]>
}
