'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { cn, Button, Popover, PopoverTrigger } from '@eous/ui'
import { Pencil, Plus } from 'lucide-react'
import type { IntervalItem, IntervalSelectorProps, IntervalSelectorState } from './types'
import { useIntervalSettings, DEFAULT_INTERVAL_SETTINGS } from './use-interval-settings'
import { IntervalPopup } from './interval-popup'
import { IntervalEditor } from './interval-editor'

export function IntervalSelector({
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
  //   Unsupported intervals are hidden from UI but preserved in config
  const supportedIntervals = useMemo(
    () => effectiveIntervals.filter((iv) => !unsupportedValues.includes(iv.value)),
    [effectiveIntervals, unsupportedValues],
  )

  // ── Split into visible and hidden ───────────────────────────────────────
  const visible = useMemo(() => supportedIntervals.filter((iv) => iv.visible), [supportedIntervals])
  const hidden = useMemo(() => supportedIntervals.filter((iv) => !iv.visible), [supportedIntervals])

  // ── State machine ───────────────────────────────────────────────────────
  const [state, setState] = useState<IntervalSelectorState>('idle')
  const [popupOpen, setPopupOpen] = useState(false)

  // Close editor on Escape
  useEffect(() => {
    if (state !== 'editing') return

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setState('idle')
    }

    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [state])

  // Select from popup
  const handlePopupSelect = useCallback(
    (iv: string) => {
      onChange(iv)
      setPopupOpen(false)
    },
    [onChange],
  )

  // Save from editor
  const handleEditorSave = useCallback(
    (next: IntervalItem[]) => {
      updateIntervals(next)
      setState('idle')
    },
    [updateIntervals],
  )

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="relative">
      {/* Toolbar row */}
      <div className="flex items-center gap-1">
        {visible.map((iv) => (
          <Button
            variant="ghost"
            key={iv.value}
            onClick={() => onChange(iv.value)}
            className={cn(
              'px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors',
              iv.value === value
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            {iv.label}
          </Button>
        ))}

        {/* "+" button — opens popup of remaining intervals */}
        {hidden.length > 0 && (
          <Popover open={popupOpen} onOpenChange={setPopupOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  'ml-0.5 p-0.5 rounded transition-colors',
                  popupOpen
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                )}
                aria-label="More intervals"
              >
                <Plus size={12} strokeWidth={2.5} />
              </Button>
            </PopoverTrigger>
            <IntervalPopup items={hidden} onSelect={handlePopupSelect} />
          </Popover>
        )}

        {/* ✎ edit button */}
        <Button
          variant="ghost"
          onClick={() => setState(state === 'editing' ? 'idle' : 'editing')}
          className={cn(
            'ml-0.5 p-0.5 rounded transition-colors',
            state === 'editing'
              ? 'text-primary bg-primary/10'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
          )}
          aria-label="Edit intervals"
        >
          <Pencil size={11} strokeWidth={2.5} />
        </Button>
      </div>

      {/* Editor overlay */}
      {state === 'editing' && (
        <IntervalEditor
          intervals={effectiveIntervals}
          onSave={handleEditorSave}
          onCancel={() => setState('idle')}
          unsupportedValues={unsupportedValues}
        />
      )}
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const depsKey = `${serializedPersisted}|${serializedVisible}|${serializedHidden}`

  return useMemo(() => {
    if (!defaultVisible && !defaultHidden) {
      return persisted
    }

    // Build base from overrides
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

    // Merge persisted visibility flags onto base
    const persistedMap = new Map(persisted.map((iv) => [iv.value, iv]))
    return base.map((iv) => persistedMap.get(iv.value) ?? iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey])
}
