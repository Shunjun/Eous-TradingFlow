/** A single interval in the ordered configuration list */
export interface IntervalItem {
  label: string
  value: string
  /** Whether this interval shows on the toolbar (vs hidden in "+") */
  visible: boolean
  /** Whether this interval is supported by the current data provider */
  supported: boolean
}

/** Persisted user settings — the full ordered list with visibility flags */
export interface IntervalSettings {
  visible: string[]
  custom: { value: string; label?: string }[]
}

// ── Props ───────────────────────────────────────────────────────────────────

export interface IntervalSelectorProps {
  /** Currently selected interval value */
  value: string
  /** Called when user selects a different interval */
  onChange: (interval: string) => void
  /** Interval values that the current provider does NOT support */
  unsupportedValues?: string[]
  /** Full interval configuration for the chart. */
  intervals: IntervalItem[]
  /** Persist visibility/custom interval changes. */
  onIntervalsChange: (intervals: IntervalItem[]) => void | Promise<void>
}

// ── State machine ───────────────────────────────────────────────────────────

export type IntervalSelectorState = 'idle' | 'editing'
