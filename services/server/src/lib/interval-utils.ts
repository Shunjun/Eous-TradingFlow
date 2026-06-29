const UNIT_MS: Record<string, number> = {
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
}

/** Parse interval string to ms, e.g. "5m" → 300000, "1d" → 86400000 */
export function parseIntervalMs(interval: string): number {
  const match = interval.match(/^(\d+)([mhdw])$/)
  if (!match) return 24 * 60 * 60 * 1000
  return Number(match[1]) * UNIT_MS[match[2]]
}
