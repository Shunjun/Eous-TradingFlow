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
  intervals: IntervalItem[]
}

// ── Props ───────────────────────────────────────────────────────────────────

export interface IntervalSelectorProps {
  /** Currently selected interval value */
  value: string
  /** Called when user selects a different interval */
  onChange: (interval: string) => void
  /** Interval values that the current provider does NOT support */
  unsupportedValues?: string[]
  /** Custom storage key for persistence (default uses a chart-global key) */
  storageKey?: string
  /** Override default intervals (useful for testing or custom deployments) */
  defaultVisible?: IntervalItem[]
  defaultHidden?: IntervalItem[]
}

// ── State machine ───────────────────────────────────────────────────────────

export type IntervalSelectorState = 'idle' | 'editing'
