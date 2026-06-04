import type { IndicatorDefinition } from '../../types'
import { calculateBollingerBands } from './calculator'
import { BollingerBandsSettings } from './settings'

export function createBollingerBandsDefinition(): IndicatorDefinition {
  return {
    type: 'bollinger-bands',
    label: 'Bollinger Bands',
    category: 'trend',
    defaultParams: { period: 20, stdDev: 2 },
    paramConfig: [
      { key: 'period', label: 'Period', min: 5, max: 100, step: 1 },
      { key: 'stdDev', label: 'Std Dev', min: 0.5, max: 5, step: 0.5 },
    ],
    defaultMode: 'overlay',
    calculate: (closes, params) => calculateBollingerBands(closes, params),
    seriesCount: 3,
    seriesTypes: ['Line', 'Line', 'Line'],
    defaultColors: ['hsl(160, 84%, 39%)', 'hsl(160, 84%, 39%)', 'hsl(160, 84%, 39%)'],
    seriesLabels: ['Upper', 'Middle', 'Lower'],
    SettingsComponent: BollingerBandsSettings,
  }
}
