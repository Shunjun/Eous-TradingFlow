import type { IntervalAggregation, IntervalSupport, Kline } from './types.js'

export type IntervalUnit = 's' | 'm' | 'h' | 'd' | 'w' | 'M' | 'y'

export interface ParsedInterval {
  amount: number
  unit: IntervalUnit
  value: string
}

const UNIT_ORDER: Record<IntervalUnit, number> = {
  s: 0,
  m: 1,
  h: 2,
  d: 3,
  w: 4,
  M: 5,
  y: 6,
}

const DURATION_MS: Partial<Record<IntervalUnit, number>> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
}

export function parseInterval(interval: string): ParsedInterval | null {
  const match = interval.trim().match(/^(\d+)([smhdwMy])$/)
  if (!match) return null

  const amount = Number(match[1])
  const unit = match[2] as IntervalUnit
  if (!Number.isInteger(amount) || amount <= 0) return null

  return canonicalizeParsedInterval({ amount, unit, value: `${amount}${unit}` })
}

export function canonicalizeInterval(interval: string): string | null {
  return parseInterval(interval)?.value ?? null
}

function canonicalizeParsedInterval(interval: ParsedInterval): ParsedInterval {
  let { amount, unit } = interval

  if (unit === 's' && amount % 60 === 0) {
    amount /= 60
    unit = 'm'
  }
  if (unit === 'm' && amount % 60 === 0) {
    amount /= 60
    unit = 'h'
  }
  if (unit === 'h' && amount % 24 === 0) {
    amount /= 24
    unit = 'd'
  }
  if (unit === 'd' && amount % 7 === 0) {
    amount /= 7
    unit = 'w'
  }
  if (unit === 'M' && amount % 12 === 0) {
    amount /= 12
    unit = 'y'
  }

  return { amount, unit, value: `${amount}${unit}` }
}

export function compareIntervals(a: string, b: string): number {
  const left = parseInterval(a)
  const right = parseInterval(b)
  if (!left && !right) return a.localeCompare(b)
  if (!left) return 1
  if (!right) return -1

  const unitDelta = UNIT_ORDER[left.unit] - UNIT_ORDER[right.unit]
  return unitDelta || left.amount - right.amount
}

export function getIntervalAggregation(interval: string): IntervalAggregation | undefined {
  const parsed = parseInterval(interval)
  if (!parsed) return undefined
  return parsed.unit === 'M' || parsed.unit === 'y' ? 'calendar' : 'duration'
}

export function resolveIntervalSupport(params: {
  requestedIntervals: string[]
  nativeIntervals: string[]
}): IntervalSupport[] {
  const nativeByValue = new Map<string, ParsedInterval>()

  for (const interval of params.nativeIntervals) {
    const parsed = parseInterval(interval)
    if (parsed) nativeByValue.set(parsed.value, parsed)
  }

  const native = Array.from(nativeByValue.values()).sort((a, b) =>
    compareIntervals(a.value, b.value),
  )

  return params.requestedIntervals.map((requestedInterval) => {
    const target = parseInterval(requestedInterval)
    if (!target) {
      return {
        requestedInterval,
        interval: requestedInterval,
        supported: false,
        reason: 'Invalid interval format',
      }
    }

    if (nativeByValue.has(target.value)) {
      return {
        requestedInterval,
        interval: target.value,
        supported: true,
        mode: 'native',
      }
    }

    const targetMonths = target.unit === 'y' ? target.amount * 12 : null
    const candidates = native.filter((item) => {
      if (item.unit === target.unit) {
        return item.amount < target.amount && target.amount % item.amount === 0
      }

      if (targetMonths != null && item.unit === 'M') {
        return item.amount < targetMonths && targetMonths % item.amount === 0
      }

      return false
    })
    const base = candidates[candidates.length - 1]

    if (!base) {
      return {
        requestedInterval,
        interval: target.value,
        supported: false,
        reason: 'Provider cannot supply a compatible base interval',
      }
    }

    return {
      requestedInterval,
      interval: target.value,
      supported: true,
      mode: 'derived',
      baseInterval: base.value,
      aggregation: getIntervalAggregation(target.value),
    }
  })
}

export function intervalToMs(interval: string): number | null {
  const parsed = parseInterval(interval)
  if (!parsed) return null
  const unitMs = DURATION_MS[parsed.unit]
  return unitMs == null ? null : parsed.amount * unitMs
}

export function getDefaultKlineBarCount(interval: string): number {
  const parsed = parseInterval(interval)
  if (!parsed) return 365

  switch (parsed.unit) {
    case 's':
    case 'm':
    case 'h':
    case 'd':
      return 365
    case 'w':
      return parsed.amount === 1 ? 260 : 160
    case 'M':
      if (parsed.amount <= 1) return 120
      if (parsed.amount <= 3) return 80
      return 60
    case 'y':
      return 30
  }
}

export function subtractIntervals(timestamp: number, interval: string, count: number): number {
  const parsed = parseInterval(interval)
  if (!parsed || !Number.isFinite(timestamp) || !Number.isFinite(count)) return timestamp

  const steps = parsed.amount * count
  const date = new Date(timestamp)

  switch (parsed.unit) {
    case 's':
      date.setUTCSeconds(date.getUTCSeconds() - steps)
      break
    case 'm':
      date.setUTCMinutes(date.getUTCMinutes() - steps)
      break
    case 'h':
      date.setUTCHours(date.getUTCHours() - steps)
      break
    case 'd':
      date.setUTCDate(date.getUTCDate() - steps)
      break
    case 'w':
      date.setUTCDate(date.getUTCDate() - steps * 7)
      break
    case 'M':
      date.setUTCMonth(date.getUTCMonth() - steps)
      break
    case 'y':
      date.setUTCFullYear(date.getUTCFullYear() - steps)
      break
  }

  return date.getTime()
}

export function aggregateKlines(
  klines: Kline[],
  targetInterval: string,
  aggregation = getIntervalAggregation(targetInterval),
): Kline[] {
  if (aggregation === 'calendar') return aggregateCalendarKlines(klines, targetInterval)
  return aggregateDurationKlines(klines, targetInterval)
}

function aggregateDurationKlines(klines: Kline[], targetInterval: string): Kline[] {
  const intervalMs = intervalToMs(targetInterval)
  if (!intervalMs) return klines

  const buckets = new Map<number, Kline[]>()
  for (const kline of klines) {
    const bucketTime = Math.floor(kline.timestamp / intervalMs) * intervalMs
    const bucket = buckets.get(bucketTime)
    if (bucket) bucket.push(kline)
    else buckets.set(bucketTime, [kline])
  }

  return mergeBuckets(buckets)
}

function aggregateCalendarKlines(klines: Kline[], targetInterval: string): Kline[] {
  const parsed = parseInterval(targetInterval)
  if (!parsed || (parsed.unit !== 'M' && parsed.unit !== 'y')) return klines

  const buckets = new Map<number, Kline[]>()
  for (const kline of klines) {
    const date = new Date(kline.timestamp)
    const year = date.getUTCFullYear()
    const month = date.getUTCMonth()
    const bucketStart =
      parsed.unit === 'M'
        ? Date.UTC(year, Math.floor(month / parsed.amount) * parsed.amount, 1)
        : Date.UTC(Math.floor(year / parsed.amount) * parsed.amount, 0, 1)

    const bucket = buckets.get(bucketStart)
    if (bucket) bucket.push(kline)
    else buckets.set(bucketStart, [kline])
  }

  return mergeBuckets(buckets)
}

function mergeBuckets(buckets: Map<number, Kline[]>): Kline[] {
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([timestamp, bucket]) => {
      const sorted = [...bucket].sort((a, b) => a.timestamp - b.timestamp)
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      return {
        timestamp,
        open: first.open,
        high: Math.max(...sorted.map((item) => item.high)),
        low: Math.min(...sorted.map((item) => item.low)),
        close: last.close,
        volume: sorted.reduce((sum, item) => (item.volume == null ? sum : sum + item.volume), 0),
      }
    })
}
