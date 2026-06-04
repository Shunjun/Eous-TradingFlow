import type { IndicatorSettingsProps } from '../../types'
import { toHex } from '../../utils/color'

const DEFAULT_COLORS = ['hsl(160, 84%, 39%)', 'hsl(160, 84%, 39%)', 'hsl(160, 84%, 39%)']
const COLOR_LABELS = ['Upper', 'Middle', 'Lower']

export function BollingerBandsSettings({ config, onUpdate, onRemove }: IndicatorSettingsProps) {
  const period = config.params.period ?? 20
  const stdDev = config.params.stdDev ?? 2
  const colors = config.colors ?? DEFAULT_COLORS

  function updateColor(index: number, color: string) {
    const next = [...colors]
    next[index] = color
    onUpdate({ colors: next })
  }

  return (
    <div className="flex flex-col gap-3 p-3 font-mono text-xs">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Period</span>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={5}
            max={100}
            step={1}
            value={period}
            onChange={(e) => onUpdate({ params: { ...config.params, period: Number(e.target.value) } })}
            className="w-24 accent-primary"
          />
          <span className="w-8 text-right tabular-nums">{period}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Std Dev</span>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0.5}
            max={5}
            step={0.5}
            value={stdDev}
            onChange={(e) => onUpdate({ params: { ...config.params, stdDev: Number(e.target.value) } })}
            className="w-24 accent-primary"
          />
          <span className="w-8 text-right tabular-nums">{stdDev}</span>
        </div>
      </div>

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
