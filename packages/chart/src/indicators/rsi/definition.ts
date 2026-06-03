import type { IndicatorDefinition } from '../../types'
import { calculateRSI } from './calculator'
import { RSISettings } from './settings'

export function createRSIDefinition(): IndicatorDefinition {
  return {
    type: 'rsi',
    label: 'RSI',
    category: 'oscillator',
    defaultParams: { period: 14 },
    paramConfig: [{ key: 'period', label: '周期', min: 2, max: 100, step: 1 }],
    defaultMode: 'split',
    calculate: (closes, params) => calculateRSI(closes, params.period),
    seriesCount: 1,
    seriesTypes: ['Line'],
    defaultColors: ['hsl(280, 67%, 60%)'],
    seriesLabels: ['RSI({period})'],
    SettingsComponent: RSISettings,
  }
}
