import { klineViewEntry } from './kline/index.js'
import type { ViewRegistryEntry, ViewType } from './types.js'

export type {
  SerializableViewState,
  ViewRegistryEntry,
  ViewStateBridge,
  ViewType,
} from './types.js'

export const VIEW_REGISTRY = [klineViewEntry] satisfies ViewRegistryEntry[]

export function getViewEntry(type: ViewType): ViewRegistryEntry | undefined {
  return VIEW_REGISTRY.find((entry) => entry.type === type)
}
