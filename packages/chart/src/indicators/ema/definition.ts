import type { IndicatorDefinition } from '../../types'
import { calculateEMA } from './calculator'
import { EMASettings } from './settings'

export function createEMADefinition(): IndicatorDefinition {
  return {
    type: 'ema',
    label: 'EMA',
    category: 'trend',
    defaultParams: { period: 12 },
    paramConfig: [{ key: 'period', label: 'Period', min: 2, max: 200, step: 1 }],
    defaultMode: 'overlay',
    calculate: (closes, params) => calculateEMA(closes, params.period),
    seriesCount: 1,
    seriesTypes: ['Line'],
    defaultColors: ['hsl(217, 91%, 60%)'],
    seriesLabels: ['EMA({period})'],
    SettingsComponent: EMASettings,
  }
}
