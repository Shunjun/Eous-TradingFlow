import { cn } from '@eous/ui'
import { IndicatorPopover } from './indicator-popover'
import type { IndicatorConfig, IntervalOption } from '../types'

interface ChartToolbarProps {
  interval: string
  intervals: IntervalOption[]
  onIntervalChange: (interval: string) => void
  symbol?: string
  indicators: IndicatorConfig[]
  onAddIndicator: (config: IndicatorConfig) => void
  onRemoveIndicator: (id: string) => void
  onToggleIndicator: (id: string) => void
  onSwitchIndicatorMode: (id: string, mode: 'overlay' | 'split') => void
  onMoveIndicatorUp: (id: string) => void
  onMoveIndicatorDown: (id: string) => void
}

export function ChartToolbar({
  interval,
  intervals,
  onIntervalChange,
  symbol,
  indicators,
  onAddIndicator,
  onRemoveIndicator,
  onToggleIndicator,
  onSwitchIndicatorMode,
  onMoveIndicatorUp,
  onMoveIndicatorDown,
}: ChartToolbarProps) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0 gap-2">
      {/* Left: symbol */}
      <div className="flex items-center gap-2 min-w-0 shrink-0">
        {symbol && (
          <span className="font-mono text-xs text-muted-foreground tracking-wide truncate">
            {symbol}
          </span>
        )}
      </div>

      {/* Center: interval buttons */}
      <div className="flex items-center gap-1">
        {intervals.map((iv) => (
          <button
            key={iv.value}
            onClick={() => onIntervalChange(iv.value)}
            className={cn(
              'px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors',
              iv.value === interval
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            {iv.label}
          </button>
        ))}
      </div>

      {/* Right: indicator management */}
      <div className="flex items-center gap-1 shrink-0">
        <IndicatorPopover
          indicators={indicators}
          onAdd={onAddIndicator}
          onRemove={onRemoveIndicator}
          onToggle={onToggleIndicator}
          onSwitchMode={onSwitchIndicatorMode}
          onMoveUp={onMoveIndicatorUp}
          onMoveDown={onMoveIndicatorDown}
        />
      </div>
    </div>
  )
}
