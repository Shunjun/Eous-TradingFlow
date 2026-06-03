import { useState, useCallback } from 'react'
import { cn, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@eous/ui'
import { Plus } from 'lucide-react'
import type { IntervalOption, ProviderOption, SymbolItem } from '../types'
import { SymbolSelector } from './symbol-selector'
import { IntervalSelector } from './interval-selector'
import { getAllIndicatorDefinitions, getIndicatorDefinition } from '../indicators/registry'
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
  // Interval
  interval: string
  intervals: IntervalOption[]
  onIntervalChange: (interval: string) => void
  unsupportedIntervals?: string[]

  // Symbol selector
  symbol?: string
  providers?: ProviderOption[]
  symbols?: SymbolItem[]
  activeProviderId?: string
  onSymbolSelect?: (item: SymbolItem) => void
  onSearchChange?: (query: string) => void
  onProviderChange?: (providerId: string) => void
  symbolsLoading?: boolean

  // Indicator add
  onAddIndicator?: (config: IndicatorConfig) => void

  // Container ref for Dialog portal
  containerRef?: React.RefObject<HTMLElement | null>
}

// ── Component ───────────────────────────────────────────────────────────────

export function ChartToolbar({
  interval,
  intervals,
  onIntervalChange,
  unsupportedIntervals,
  symbol,
  providers,
  symbols,
  activeProviderId,
  onSymbolSelect,
  onSearchChange,
  onProviderChange,
  symbolsLoading,
  onAddIndicator,
  containerRef,
}: ChartToolbarProps) {
  const [indicatorOpen, setIndicatorOpen] = useState(false)

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

  return (
    <div className="flex items-center px-3 py-1.5 border-b border-border shrink-0 gap-0">
      {/* Left: Symbol selector */}
      {providers && providers.length > 0 && (
        <>
          <SymbolSelector
            symbol={symbol || undefined}
            providers={providers}
            symbols={symbols ?? []}
            activeProviderId={activeProviderId ?? ''}
            onSymbolSelect={onSymbolSelect ?? (() => {})}
            onSearchChange={onSearchChange}
            onProviderChange={onProviderChange ?? (() => {})}
            loading={symbolsLoading}
            containerRef={containerRef}
          />
          {/* Divider */}
          <div className="w-px h-4 bg-border mx-2 shrink-0" />
        </>
      )}

      {/* Center: Interval selector */}
      <IntervalSelector
        value={interval}
        onChange={onIntervalChange}
        unsupportedValues={unsupportedIntervals}
      />

      {/* Right spacer + indicator add */}
      <div className="flex-1" />

      {onAddIndicator && (
        <div className="w-px h-4 bg-border mx-2 shrink-0" />
      )}

      {onAddIndicator && (
        <DropdownMenu open={indicatorOpen} onOpenChange={setIndicatorOpen}>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-colors',
                'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              <Plus size={11} strokeWidth={2.5} />
              <span>Indicator</span>
            </button>
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
