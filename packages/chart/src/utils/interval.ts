const UNIT_MS: Record<string, number> = {
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
}

/** Parse interval string to ms, e.g. "5m" → 300000, "1d" → 86400000 */
export function parseIntervalMs(interval: string): number {
  const match = interval.match(/^(\d+)([mhdw])$/)
  if (!match) return 86_400_000 // fallback 1d
  return Number(match[1]) * UNIT_MS[match[2]]
}
