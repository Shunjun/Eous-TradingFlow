import type { Time } from 'lightweight-charts'
import type { FetchKlinesFn, SubscribeKlineUpdatesFn } from './core/kline-data'
import type { GetSymbolsFn, GetIntervalsFn, GetProvidersFn } from './stores/chart-store'

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
  /** Data fetching function for kline data */
  fetchKlines: FetchKlinesFn
  /** Optional realtime kline update subscription. REST remains the source for initial/history data. */
  subscribeKlineUpdates?: SubscribeKlineUpdatesFn
  /** Fetch available symbols for a provider (with optional search/pagination) */
  getSymbols: GetSymbolsFn
  /** Fetch available intervals for a provider */
  getIntervals: GetIntervalsFn
  /** Fetch available data providers */
  getProviders: GetProvidersFn
  /** Fetch saved drawing payload for the active provider+symbol */
  getDrawings?: (params: { providerId: string; symbol: string }) => Promise<string | null>
  /** Save changed drawing payloads for one provider instance */
  saveDrawings?: (params: {
    providerId: string
    drawings: { symbol: string; payload: string }[]
  }) => Promise<void>
  /** Fetch chart-level user config */
  getChartConfig?: () => Promise<{ autoSaveDrawings: boolean }>
  /** Persist chart-level user config */
  saveChartConfig?: (config: { autoSaveDrawings: boolean }) => Promise<void>

  /** Default symbol to display on mount */
  defaultSymbol?: string
  /** Default provider to use on mount */
  defaultProviderId?: string
  /** Default interval (e.g. "1m", "5m", "15m", "1h", "4h", "1d", "1w") */
  defaultInterval?: string

  /** Called when the selected symbol changes */
  onSymbolChange?: (symbol: string | null) => void
  /** Called when the selected provider changes */
  onProviderChange?: (providerId: string) => void
  /** Called when the selected interval changes */
  onIntervalChange?: (interval: string) => void
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
  /** Provider-specific fallback symbol used when a panel has no saved symbol */
  defaultSymbol: string
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
