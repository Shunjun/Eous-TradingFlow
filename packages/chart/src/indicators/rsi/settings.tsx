import type { IndicatorSettingsProps } from '../../types'
import { toHex } from '../../utils/color'

export function RSISettings({ config, onUpdate, onRemove }: IndicatorSettingsProps) {
  const period = config.params.period ?? 14

  return (
    <div className="flex flex-col gap-3 p-3 font-mono text-xs">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">周期</span>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={2}
            max={100}
            step={1}
            value={period}
            onChange={(e) => onUpdate({ params: { ...config.params, period: Number(e.target.value) } })}
            className="w-24 accent-primary"
          />
          <span className="w-8 text-right tabular-nums">{period}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">颜色</span>
        <input
          type="color"
          value={toHex(config.color ?? config.colors?.[0] ?? '#a855f7')}
          onChange={(e) => onUpdate({ color: e.target.value, colors: [e.target.value] })}
          className="w-6 h-6 rounded cursor-pointer border border-border"
        />
      </div>

      <button
        onClick={onRemove}
        className="mt-1 px-2 py-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
      >
        删除指标
      </button>
    </div>
  )
}
