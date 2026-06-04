'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  cn,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ToggleGroup,
  ToggleGroupItem,
} from '@eous/ui'
import { Plus, Pencil } from 'lucide-react'
import type { IntervalItem, IntervalSelectorProps } from './interval-selector/types'
import { IntervalEditor } from './interval-selector/interval-editor'
import { useIntervalSettings } from '../hooks/use-interval-settings'

export function IndicatorSelector({
  value,
  onChange,
  unsupportedValues = [],
  storageKey,
  defaultVisible,
  defaultHidden,
}: IntervalSelectorProps) {
  const { settings, updateIntervals } = useIntervalSettings(storageKey)

  // ── Derive effective intervals ──────────────────────────────────────────
  const effectiveIntervals = useMemoEffectedIntervals(
    settings.intervals,
    defaultVisible,
    defaultHidden,
  )

  // ── Filter by provider support ──────────────────────────────────────────
  const supportedIntervals = useMemo(
    () => effectiveIntervals.filter((iv) => !unsupportedValues.includes(iv.value)),
    [effectiveIntervals, unsupportedValues],
  )

  // ── Split into visible and hidden ───────────────────────────────────────
  const visible = useMemo(() => supportedIntervals.filter((iv) => iv.visible), [supportedIntervals])
  const hidden = useMemo(() => supportedIntervals.filter((iv) => !iv.visible), [supportedIntervals])

  // ── State machine ───────────────────────────────────────────────────────
  const [popupMode, setPopupMode] = useState<'select' | 'editing'>('select')
  const [popupOpen, setPopupOpen] = useState(false)

  // Reset to select mode when popup closes
  useEffect(() => {
    if (!popupOpen) setPopupMode('select')
  }, [popupOpen])

  // Close on Escape
  useEffect(() => {
    if (!popupOpen) return

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (popupMode === 'editing') {
          setPopupMode('select')
        } else {
          setPopupOpen(false)
        }
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [popupOpen, popupMode])

  // Select from popup
  const handlePopupSelect = useCallback(
    (iv: string) => {
      onChange(iv)
      setPopupOpen(false)
    },
    [onChange],
  )

  // Save from editor → back to select mode, keep popup open
  const handleEditorSave = useCallback(
    (next: IntervalItem[]) => {
      updateIntervals(next)
      setPopupMode('select')
    },
    [updateIntervals],
  )

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="relative">
      {/* Toolbar row */}
      <div className="flex items-center gap-1">
        <ToggleGroup
          type="single"
          value={value}
          onValueChange={(next) => {
            if (next) onChange(next)
          }}
          size="xs"
          spacing={1}
        >
          {visible.map((iv) => (
            <ToggleGroupItem key={iv.value} value={iv.value}>
              {iv.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {/* "+" button — dual-mode popup */}
        <Popover open={popupOpen} onOpenChange={setPopupOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="xs"
              className={cn(
                'ml-0.5 transition-colors',
                popupOpen
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
              aria-label="More intervals"
            >
              <Plus strokeWidth={2.5} />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={4} className="w-auto p-0">
            {popupMode === 'select' ? (
              <div className="min-w-[180px]">
                {/* Header with Edit button */}
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
                  <span className="text-[10px] font-mono text-muted-foreground">Intervals</span>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="h-5 px-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground"
                    onClick={() => setPopupMode('editing')}
                  >
                    <Pencil size={10} className="mr-1" />
                    Edit
                  </Button>
                </div>

                {/* Hidden intervals list */}
                {hidden.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground/40 text-center py-3 font-mono px-3">
                    All intervals are visible
                  </div>
                ) : (
                  <div className="p-2 flex flex-wrap gap-1">
                    {hidden.map((iv) => (
                      <Button
                        variant="ghost"
                        key={iv.value}
                        onClick={() => handlePopupSelect(iv.value)}
                        className={cn(
                          'px-2 py-1 text-[10px] font-mono rounded transition-colors',
                          'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                        )}
                      >
                        {iv.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="min-w-[220px]">
                <IntervalEditor
                  intervals={effectiveIntervals}
                  onSave={handleEditorSave}
                  onCancel={() => setPopupMode('select')}
                  unsupportedValues={unsupportedValues}
                />
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

/**
 * Merge persisted intervals with any prop overrides (defaultVisible / defaultHidden).
 *
 * When prop overrides are provided, they serve as the base schema and the
 * persisted flags (visible/hidden) are merged on top — so user edits survive
 * page reloads even when the host passes a custom interval set.
 */
function useMemoEffectedIntervals(
  persisted: IntervalItem[],
  defaultVisible?: IntervalItem[],
  defaultHidden?: IntervalItem[],
): IntervalItem[] {
  const serializedPersisted = JSON.stringify(persisted)
  const serializedVisible = JSON.stringify(defaultVisible)
  const serializedHidden = JSON.stringify(defaultHidden)

  const depsKey = `${serializedPersisted}|${serializedVisible}|${serializedHidden}`

  return useMemo(() => {
    if (!defaultVisible && !defaultHidden) {
      return persisted
    }

    const base: IntervalItem[] = [
      ...(defaultVisible?.map((iv) => ({
        ...iv,
        visible: true,
        supported: iv.supported ?? true,
      })) ?? []),
      ...(defaultHidden?.map((iv) => ({
        ...iv,
        visible: false,
        supported: iv.supported ?? true,
      })) ?? []),
    ]

    const persistedMap = new Map(persisted.map((iv) => [iv.value, iv]))
    return base.map((iv) => persistedMap.get(iv.value) ?? iv)
  }, [depsKey])
}
