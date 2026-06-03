import type { Time } from 'lightweight-charts'
import type { FetchKlinesFn } from './core/kline-data'

// ── Data ────────────────────────────────────────────────────────────────────

export interface OhlcvData {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export interface ParsedBar {
  time: Time
  open: number
  high: number
  low: number
  close: number
}

export interface VolumeBar {
  time: Time
  value: number
  color: string
}

// ── Theme ───────────────────────────────────────────────────────────────────

export interface ChartTheme {
  background: string
  foreground: string
  mutedForeground: string
  border: string
  upColor: string
  downColor: string
  upColorTransparent: string
  downColorTransparent: string
}

// ── Interval ────────────────────────────────────────────────────────────────

export interface IntervalOption {
  /** Display label, e.g. "1m", "5m", "1h", "1d" */
  label: string
  /** Internal value used for requests */
  value: string
}

// ── Component Props ─────────────────────────────────────────────────────────

export interface KlineChartProps {
  /** Symbol to display (e.g. "BTC/USDT") */
  symbol?: string
  /** Initial interval (e.g. "1m", "5m", "15m", "1h", "4h", "1d", "1w"). Component manages state internally. */
  interval?: string
  /** Available intervals from the data provider. If empty, no interval buttons shown. */
  intervals?: IntervalOption[]
  /** Called when user changes interval via toolbar */
  onIntervalChange?: (interval: string) => void
  /** Data fetching function provided by the app layer */
  fetchKlines?: FetchKlinesFn

  // ── Symbol selector props ────────────────────────────────────────────────
  /** Available data providers */
  providers?: ProviderOption[]
  /** Symbols for the current provider */
  symbols?: SymbolItem[]
  /** Active provider ID */
  activeProviderId?: string
  /** Called when user selects a symbol */
  onSymbolSelect?: (item: SymbolItem) => void
  /** Called when search text changes (for async search) */
  onSearchChange?: (query: string) => void
  /** Called when user switches provider */
  onProviderChange?: (providerId: string) => void
  /** Whether symbol list is loading */
  symbolsLoading?: boolean

  // ── Interval selector props ──────────────────────────────────────────────
  /** Interval values the provider does NOT support (hidden from toolbar but preserved in config) */
  unsupportedIntervals?: string[]
}

// ── Indicators ──────────────────────────────────────────────────────────────

export type IndicatorDisplayMode = 'overlay' | 'split'

export interface IndicatorConfig {
  id: string
  type: string
  label: string
  enabled: boolean
  mode: IndicatorDisplayMode
  params: Record<string, number>
  color?: string
  /** Per-series colors (for multi-series indicators like MACD, Bollinger Bands) */
  colors?: string[]
}

export interface IndicatorDataPoint {
  time: Time
  value: number
}

export type IndicatorOutput = IndicatorDataPoint[][]

export interface ParamConfig {
  key: string
  label: string
  min: number
  max: number
  step: number
}

export interface IndicatorSettingsProps {
  config: IndicatorConfig
  onUpdate: (updates: Partial<IndicatorConfig>) => void
  onRemove: () => void
}

// ── Symbol Selector ──────────────────────────────────────────────────────────

export interface ProviderOption {
  /** Provider instance ID */
  id: string
  /** Display name (e.g. "Yahoo Finance", "CCXT") */
  name: string
}

export interface SymbolItem {
  /** Symbol code (e.g. "BTC/USDT", "AAPL") */
  symbol: string
  /** Human-readable name (e.g. "Bitcoin / Tether", "Apple Inc.") */
  name: string
  /** Exchange identifier */
  exchange?: string
  /** Asset type */
  type?: string
  /** Provider instance ID this symbol belongs to */
  providerId: string
}

export interface IndicatorDefinition {
  type: string
  label: string
  category: 'trend' | 'oscillator'
  defaultParams: Record<string, number>
  paramConfig: ParamConfig[]
  defaultMode: IndicatorDisplayMode
  calculate: (
    closes: { time: Time; close: number }[],
    params: Record<string, number>,
  ) => IndicatorOutput
  seriesCount: number
  seriesTypes: ('Line' | 'Histogram')[]
  defaultColors: string[]
  seriesLabels?: string[]
  SettingsComponent: React.ComponentType<IndicatorSettingsProps>
}
