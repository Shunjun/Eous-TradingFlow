import type { IndicatorSettingsProps } from '../../types'
import { toHex } from '../../utils/color'

const DEFAULT_COLORS = ['hsl(217, 91%, 60%)', 'hsl(25, 95%, 53%)', 'hsl(220, 9%, 46%)']
const COLOR_LABELS = ['MACD', 'Signal', 'Histogram']

export function MACDSettings({ config, onUpdate, onRemove }: IndicatorSettingsProps) {
  const fast = config.params.fast ?? 12
  const slow = config.params.slow ?? 26
  const signal = config.params.signal ?? 9
  const colors = config.colors ?? DEFAULT_COLORS

  function updateParam(key: string, value: number) {
    onUpdate({ params: { ...config.params, [key]: value } })
  }

  function updateColor(index: number, color: string) {
    const next = [...colors]
    next[index] = color
    onUpdate({ colors: next })
  }

  return (
    <div className="flex flex-col gap-3 p-3 font-mono text-xs">
      {[
        { key: 'fast', label: 'Fast', value: fast, min: 2, max: 100 },
        { key: 'slow', label: 'Slow', value: slow, min: 5, max: 200 },
        { key: 'signal', label: 'Signal', value: signal, min: 2, max: 50 },
      ].map((p) => (
        <div key={p.key} className="flex items-center justify-between">
          <span className="text-muted-foreground">{p.label}</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={p.min}
              max={p.max}
              step={1}
              value={p.value}
              onChange={(e) => updateParam(p.key, Number(e.target.value))}
              className="w-24 accent-primary"
            />
            <span className="w-8 text-right tabular-nums">{p.value}</span>
          </div>
        </div>
      ))}

      <div className="flex flex-col gap-2 mt-1">
        {COLOR_LABELS.map((label, i) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-muted-foreground">{label}</span>
            <input
              type="color"
              value={toHex(colors[i] ?? DEFAULT_COLORS[i])}
              onChange={(e) => updateColor(i, e.target.value)}
              className="w-6 h-6 rounded cursor-pointer border border-border"
            />
          </div>
        ))}
      </div>

      <button
        onClick={onRemove}
        className="mt-1 px-2 py-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
      >
        Delete Indicator
      </button>
    </div>
  )
}
