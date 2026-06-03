import type { IndicatorDefinition } from '../../types'
import { calculateSMA } from './calculator'
import { SMASettings } from './settings'

export function createSMADefinition(): IndicatorDefinition {
  return {
    type: 'sma',
    label: 'SMA',
    category: 'trend',
    defaultParams: { period: 20 },
    paramConfig: [{ key: 'period', label: '周期', min: 2, max: 200, step: 1 }],
    defaultMode: 'overlay',
    calculate: (closes, params) => calculateSMA(closes, params.period),
    seriesCount: 1,
    seriesTypes: ['Line'],
    defaultColors: ['hsl(45, 93%, 47%)'],
    seriesLabels: ['SMA({period})'],
    SettingsComponent: SMASettings,
  }
}
