import { BarChart3 } from 'lucide-react'
import type { ViewRegistryEntry } from '../types.js'
import { KlineView } from './kline-view.js'
import {
  createDefaultKlineViewState,
  useKlineViewState,
  type KlineViewProps,
  type KlineViewState,
} from './use-kline-view-state.js'

export { KlineView } from './kline-view.js'
export {
  createDefaultKlineViewState,
  getKlineViewTitle,
  normalizeKlineViewState,
  useKlineViewState,
  type KlineViewProps,
  type KlineViewState,
} from './use-kline-view-state.js'

export const klineViewEntry: ViewRegistryEntry<KlineViewState, KlineViewProps> = {
  type: 'kline',
  label: 'K Line',
  icon: BarChart3,
  Component: KlineView,
  useViewState: useKlineViewState,
  createDefaultState: createDefaultKlineViewState,
}
