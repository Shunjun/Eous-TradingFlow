const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
}

type IntervalUnit = 's' | 'm' | 'h' | 'd' | 'w' | 'M' | 'y'

const UNIT_ORDER: Record<IntervalUnit, number> = {
  s: 0,
  m: 1,
  h: 2,
  d: 3,
  w: 4,
  M: 5,
  y: 6,
}

function parseInterval(interval: string): { amount: number; unit: IntervalUnit } | null {
  const match = interval.match(/^(\d+)([smhdwMy])$/)
  if (!match) return null
  const amount = Number(match[1])
  if (!Number.isInteger(amount) || amount <= 0) return null
  return { amount, unit: match[2] as IntervalUnit }
}

export function compareIntervalsAsc(a: string, b: string): number {
  const left = parseInterval(a)
  const right = parseInterval(b)
  if (!left && !right) return a.localeCompare(b)
  if (!left) return 1
  if (!right) return -1

  const unitDelta = UNIT_ORDER[left.unit] - UNIT_ORDER[right.unit]
  return unitDelta || left.amount - right.amount
}

/** Parse fixed-length interval string to ms. Calendar intervals return 1d fallback. */
export function parseIntervalMs(interval: string): number {
  const match = interval.match(/^(\d+)([smhdw])$/)
  if (!match) return 86_400_000 // fallback 1d
  return Number(match[1]) * UNIT_MS[match[2]]
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
