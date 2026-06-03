import type { IndicatorDefinition } from '../types'
import { sma, ema, macd } from './calculator'

// ── Built-in Indicator Definitions ──────────────────────────────────────────

export const INDICATOR_REGISTRY: Record<string, IndicatorDefinition> = {
  sma: {
    type: 'sma',
    label: 'SMA',
    defaultParams: { period: 20 },
    defaultMode: 'overlay',
    calculate: (closes, params) => sma(closes, params.period),
    seriesCount: 1,
    seriesTypes: ['Line'],
    defaultColors: ['hsl(45, 93%, 47%)'],
    seriesLabels: ['SMA({period})'],
  },
  ema: {
    type: 'ema',
    label: 'EMA',
    defaultParams: { period: 12 },
    defaultMode: 'overlay',
    calculate: (closes, params) => ema(closes, params.period),
    seriesCount: 1,
    seriesTypes: ['Line'],
    defaultColors: ['hsl(217, 91%, 60%)'],
    seriesLabels: ['EMA({period})'],
  },
  macd: {
    type: 'macd',
    label: 'MACD',
    defaultParams: { fast: 12, slow: 26, signal: 9 },
    defaultMode: 'split',
    calculate: (closes, params) => macd(closes, params),
    seriesCount: 3,
    seriesTypes: ['Line', 'Line', 'Histogram'],
    defaultColors: ['hsl(217, 91%, 60%)', 'hsl(25, 95%, 53%)', 'hsl(220, 9%, 46%)'],
    seriesLabels: ['MACD', 'Signal', 'Histogram'],
  },
}

export const INDICATOR_TYPES = Object.keys(INDICATOR_REGISTRY)
