import { klineViewEntry } from './kline/index.js'
import { workflowViewEntry } from './workflow/index.js'
import type { AnyViewRegistryEntry, ViewType } from './types.js'

export type {
  SerializableViewState,
  AnyViewRegistryEntry,
  ViewRegistryEntry,
  ViewStateBridge,
  ViewType,
} from './types.js'

export const VIEW_REGISTRY = [klineViewEntry, workflowViewEntry] satisfies AnyViewRegistryEntry[]

export function getViewEntry(type: ViewType): AnyViewRegistryEntry | undefined {
  return VIEW_REGISTRY.find((entry) => entry.type === type)
}
