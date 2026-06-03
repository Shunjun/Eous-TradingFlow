import { Button, cn } from '@eous/ui'
import {
  TrendingUp,
  Minus,
  MoveUpRight,
  Square,
  MousePointer2,
  Trash2,
} from 'lucide-react'
import { IndicatorPopover } from './indicator-popover'
import type { IndicatorConfig, IntervalOption } from '../types'

const DRAWING_TOOLS = [
  { id: 'none', label: '选择', icon: MousePointer2 },
  { id: 'TrendLine', label: '趋势线', icon: TrendingUp },
  { id: 'HorizontalLine', label: '水平线', icon: Minus },
  { id: 'Ray', label: '射线', icon: MoveUpRight },
  { id: 'Rectangle', label: '矩形', icon: Square },
] as const

interface ChartToolbarProps {
  // Interval
  interval: string
  intervals: IntervalOption[]
  onIntervalChange: (interval: string) => void
  // Symbol
  symbol?: string
  // Indicators
  indicators: IndicatorConfig[]
  onAddIndicator: (config: IndicatorConfig) => void
  onRemoveIndicator: (id: string) => void
  onToggleIndicator: (id: string) => void
  onSwitchIndicatorMode: (id: string, mode: 'overlay' | 'split') => void
  onMoveIndicatorUp: (id: string) => void
  onMoveIndicatorDown: (id: string) => void
  // Drawing tools
  activeDrawingTool: string
  onDrawingToolChange: (tool: string) => void
  onDeleteSelected?: () => void
  hasSelectedDrawing?: boolean
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
  activeDrawingTool,
  onDrawingToolChange,
  onDeleteSelected,
  hasSelectedDrawing,
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

      {/* Center: interval + drawing tools */}
      <div className="flex items-center gap-1">
        {/* Interval buttons */}
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

        {/* Separator */}
        <div className="w-px h-4 bg-border mx-1" />

        {/* Drawing tools */}
        {DRAWING_TOOLS.map((tool) => {
          const Icon = tool.icon
          return (
            <Button
              key={tool.id}
              variant="ghost-icon"
              size="icon"
              className={cn(
                'h-7 w-7',
                activeDrawingTool === tool.id && 'bg-primary/15 text-primary',
              )}
              onClick={() => onDrawingToolChange(tool.id)}
              title={tool.label}
            >
              <Icon size={13} />
            </Button>
          )
        })}

        {/* Delete selected */}
        {hasSelectedDrawing && (
          <Button
            variant="ghost-icon"
            size="icon"
            className="h-7 w-7 text-red-400 hover:text-red-300"
            onClick={onDeleteSelected}
            title="删除选中"
          >
            <Trash2 size={13} />
          </Button>
        )}
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
