import type { IntervalItem } from './types'

export const DEFAULT_INTERVAL_ITEMS: IntervalItem[] = [
  { label: '15m', value: '15m', visible: true, supported: true },
  { label: '1h', value: '1h', visible: true, supported: true },
  { label: '4h', value: '4h', visible: true, supported: true },
  { label: '1d', value: '1d', visible: true, supported: true },
  { label: '1w', value: '1w', visible: true, supported: true },
  { label: '1M', value: '1M', visible: true, supported: true },
  { label: '1y', value: '1y', visible: true, supported: true },
  { label: '1s', value: '1s', visible: false, supported: true },
  { label: '5s', value: '5s', visible: false, supported: true },
  { label: '15s', value: '15s', visible: false, supported: true },
  { label: '30s', value: '30s', visible: false, supported: true },
  { label: '1m', value: '1m', visible: false, supported: true },
  { label: '3m', value: '3m', visible: false, supported: true },
  { label: '5m', value: '5m', visible: false, supported: true },
  { label: '30m', value: '30m', visible: false, supported: true },
  { label: '2h', value: '2h', visible: false, supported: true },
  { label: '6h', value: '6h', visible: false, supported: true },
  { label: '12h', value: '12h', visible: false, supported: true },
  { label: '2d', value: '2d', visible: false, supported: true },
  { label: '3d', value: '3d', visible: false, supported: true },
  { label: '2w', value: '2w', visible: false, supported: true },
  { label: '3M', value: '3M', visible: false, supported: true },
  { label: '6M', value: '6M', visible: false, supported: true },
]

export const DEFAULT_VISIBLE_INTERVAL_VALUES = DEFAULT_INTERVAL_ITEMS.filter(
  (item) => item.visible,
).map((item) => item.value)

export const ALL_DEFAULT_INTERVAL_VALUES = DEFAULT_INTERVAL_ITEMS.map((item) => item.value)
