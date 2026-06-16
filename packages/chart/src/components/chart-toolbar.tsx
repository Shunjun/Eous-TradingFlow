import { useState, useCallback } from 'react'
import {
  cn,
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  Separator,
} from '@eous/ui'
import { ChevronDown, Loader2, Plus, Save, SaveAll } from 'lucide-react'
import { SymbolSelector } from './symbol-selector'
import { IntervalSelector } from './interval-selector'
import { getAllIndicatorDefinitions, getIndicatorDefinition } from '../indicators/registry'
import { useChartStore } from '../hooks/use-chart-store'
import type { IndicatorConfig } from '../types'

// ── Helpers ─────────────────────────────────────────────────────────────────

function generateIndicatorId(type: string, params: Record<string, number>): string {
  const paramStr = Object.values(params).join('-')
  return `${type}-${paramStr}`
}

function formatIndicatorLabel(type: string, params: Record<string, number>): string {
  const def = getIndicatorDefinition(type)
  if (!def) return type
  const paramStr = Object.entries(params)
    .map(([, v]) => `${v}`)
    .join(', ')
  return `${def.label}(${paramStr})`
}

// ── Props ───────────────────────────────────────────────────────────────────

interface ChartToolbarProps {
  onAddIndicator?: (config: IndicatorConfig) => void
  containerRef?: React.RefObject<HTMLElement | null>
  drawingDirtyCount?: number
  drawingsSaving?: boolean
  autoSaveDrawings?: boolean
  onSaveDrawings?: () => void | Promise<void>
  onAutoSaveDrawingsChange?: (enabled: boolean) => void | Promise<void>
}

// ── Component ───────────────────────────────────────────────────────────────

export function ChartToolbar({
  onAddIndicator,
  containerRef,
  drawingDirtyCount = 0,
  drawingsSaving = false,
  autoSaveDrawings = false,
  onSaveDrawings,
  onAutoSaveDrawingsChange,
}: ChartToolbarProps) {
  const [indicatorOpen, setIndicatorOpen] = useState(false)
  const [saveMenuOpen, setSaveMenuOpen] = useState(false)

  const interval = useChartStore((s) => s.interval)
  const unsupportedIntervals = useChartStore((s) => s.unsupportedIntervals)
  const setIntervalAction = useChartStore((s) => s.setInterval)

  const handleAddIndicator = useCallback(
    (type: string) => {
      if (!onAddIndicator) return
      const def = getIndicatorDefinition(type)
      if (!def) return
      const id = generateIndicatorId(type, def.defaultParams)
      onAddIndicator({
        id,
        type,
        label: formatIndicatorLabel(type, def.defaultParams),
        enabled: true,
        mode: def.defaultMode,
        params: { ...def.defaultParams },
        colors: [...def.defaultColors],
      })
      setIndicatorOpen(false)
    },
    [onAddIndicator],
  )

  const availableIndicators = getAllIndicatorDefinitions()
  const SaveIcon = autoSaveDrawings ? SaveAll : Save

  return (
    <div className="flex items-center px-3 py-2 border-b border-border shrink-0 gap-0">
      {/* Left: Symbol selector */}
      <SymbolSelector containerRef={containerRef} />
      <Separator orientation="vertical" className="h-4 mx-2" />

      {/* Center: Interval selector */}
      <IntervalSelector
        value={interval}
        onChange={setIntervalAction}
        unsupportedValues={unsupportedIntervals}
      />

      {/* Right spacer + indicator add */}
      <div className="flex-1" />

      {onSaveDrawings && (
        <>
          <div className="relative">
            <Button
              variant="ghost"
              size="xs"
              className={cn(
                drawingDirtyCount > 0
                  ? 'text-foreground hover:bg-muted/60'
                  : 'text-muted-foreground hover:bg-muted/40',
              )}
              disabled={drawingsSaving}
              onClick={() => onSaveDrawings()}
              aria-label="Save drawings"
            >
              {drawingsSaving ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <SaveIcon size={12} strokeWidth={2.3} />
              )}
            </Button>
            {drawingDirtyCount > 0 && (
              <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </div>

          {onAutoSaveDrawingsChange && (
            <DropdownMenu open={saveMenuOpen} onOpenChange={setSaveMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="xs" className="w-3">
                  <ChevronDown size={12} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                <DropdownMenuCheckboxItem
                  checked={autoSaveDrawings}
                  onCheckedChange={(checked) => onAutoSaveDrawingsChange(Boolean(checked))}
                  className="font-mono text-xs"
                >
                  5s auto-save
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </>
      )}

      {onSaveDrawings && onAddIndicator && (
        <Separator orientation="vertical" className="h-4 mx-2" />
      )}

      {onAddIndicator && (
        <DropdownMenu open={indicatorOpen} onOpenChange={setIndicatorOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="xs"
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-colors',
                'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              <Plus size={11} strokeWidth={2.5} />
              <span>Indicator</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[160px]">
            {availableIndicators.map((def) => (
              <DropdownMenuItem
                key={def.type}
                onClick={() => handleAddIndicator(def.type)}
                className="font-mono text-xs gap-2"
              >
                <span>{def.label}</span>
                <span className="text-muted-foreground text-[9px] ml-auto">
                  {Object.entries(def.defaultParams)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(' ')}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
