import type { IndicatorDefinition } from '../../types'
import { calculateMACD } from './calculator'
import { MACDSettings } from './settings'

export function createMACDDefinition(): IndicatorDefinition {
  return {
    type: 'macd',
    label: 'MACD',
    category: 'oscillator',
    defaultParams: { fast: 12, slow: 26, signal: 9 },
    paramConfig: [
      { key: 'fast', label: 'Fast', min: 2, max: 100, step: 1 },
      { key: 'slow', label: 'Slow', min: 5, max: 200, step: 1 },
      { key: 'signal', label: 'Signal', min: 2, max: 50, step: 1 },
    ],
    defaultMode: 'split',
    calculate: (closes, params) => calculateMACD(closes, params),
    seriesCount: 3,
    seriesTypes: ['Line', 'Line', 'Histogram'],
    defaultColors: ['hsl(217, 91%, 60%)', 'hsl(25, 95%, 53%)', 'hsl(220, 9%, 46%)'],
    seriesLabels: ['MACD', 'Signal', 'Histogram'],
    SettingsComponent: MACDSettings,
  }
}
