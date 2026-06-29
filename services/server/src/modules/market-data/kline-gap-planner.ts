import { intervalToMs, subtractIntervals } from '@eous/data-sources'
import type { CanonicalKline, KlineFetchRange } from './market-data.types.js'

export function planKlineFetchRanges(params: {
  existing: CanonicalKline[]
  from: number
  to: number
  interval: string
  includeLive: boolean
}): KlineFetchRange[] {
  if (params.to <= params.from) return []

  const intervalMs = intervalToMs(params.interval) ?? 60_000
  const overlapFrom = (timestamp: number) =>
    Math.max(0, subtractIntervals(timestamp, params.interval, 3))
  const sorted = [...params.existing].sort((a, b) => a.timestamp - b.timestamp)

  if (sorted.length === 0) {
    return [{ from: params.from, to: params.to }]
  }

  const ranges: KlineFetchRange[] = []
  const first = sorted[0]
  const last = sorted[sorted.length - 1]

  if (first.timestamp > params.from + intervalMs) {
    ranges.push({ from: params.from, to: first.timestamp })
  }

  if (last.timestamp + intervalMs < params.to) {
    ranges.push({ from: overlapFrom(last.timestamp), to: params.to })
  } else if (params.includeLive) {
    ranges.push({ from: overlapFrom(last.timestamp), to: params.to })
  }

  return ranges
}
