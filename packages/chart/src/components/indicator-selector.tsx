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
import { Pencil, Plus } from 'lucide-react'
import type { IntervalItem, IntervalSelectorProps } from './interval-selector/types'
import { IntervalEditor } from './interval-selector/interval-editor'
import { compareIntervalsAsc } from '../utils/interval'

export function IndicatorSelector({
  value,
  onChange,
  unsupportedValues = [],
  intervals,
  onIntervalsChange,
}: IntervalSelectorProps) {
  const unsupported = useMemo(() => new Set(unsupportedValues), [unsupportedValues])
  const [popupMode, setPopupMode] = useState<'select' | 'editing'>('select')
  const [popupOpen, setPopupOpen] = useState(false)

  const decoratedIntervals = useMemo(
    () =>
      intervals
        .map((item) => ({
          ...item,
          supported: item.supported && !unsupported.has(item.value),
        }))
        .sort((a, b) => compareIntervalsAsc(a.value, b.value)),
    [intervals, unsupported],
  )

  const visible = useMemo(() => {
    const items = decoratedIntervals.filter((iv) => iv.visible)
    const selectedHidden = decoratedIntervals.find((iv) => iv.value === value && !iv.visible)
    return selectedHidden
      ? [...items, selectedHidden].sort((a, b) => compareIntervalsAsc(a.value, b.value))
      : items
  }, [decoratedIntervals, value])

  useEffect(() => {
    if (!popupOpen) setPopupMode('select')
  }, [popupOpen])

  useEffect(() => {
    if (!popupOpen) return

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (popupMode === 'editing') setPopupMode('select')
        else setPopupOpen(false)
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [popupOpen, popupMode])

  const handleSelect = useCallback(
    (item: IntervalItem) => {
      if (!item.supported) return
      onChange(item.value)
      setPopupOpen(false)
    },
    [onChange],
  )

  const handleEditorSave = useCallback(
    async (next: IntervalItem[]) => {
      await onIntervalsChange(next)
      setPopupMode('select')
    },
    [onIntervalsChange],
  )

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <ToggleGroup
          type="single"
          value={value}
          onValueChange={(next) => {
            const item = visible.find((iv) => iv.value === next)
            if (item?.supported) onChange(next)
          }}
          size="xs"
          spacing={1}
        >
          {visible.map((iv) => (
            <ToggleGroupItem
              key={iv.value}
              value={iv.value}
              disabled={!iv.supported}
              className={cn(
                'data-[state=off]:text-muted-foreground',
                !iv.supported && 'opacity-35 line-through',
              )}
            >
              {iv.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

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
              <div>
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="text-[10px] font-mono text-muted-foreground">Intervals</span>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="h-6 px-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground"
                    onClick={() => setPopupMode('editing')}
                  >
                    <Pencil size={10} className="mr-1" />
                    Edit
                  </Button>
                </div>

                <ToggleGroup
                  type="single"
                  value={value}
                  onValueChange={(next) => {
                    const item = decoratedIntervals.find((iv) => iv.value === next)
                    if (item) handleSelect(item)
                  }}
                  size="xs"
                  spacing={1}
                  className="grid grid-cols-[repeat(5,3rem)] gap-1.5 p-2"
                >
                  {decoratedIntervals.map((iv) => (
                    <ToggleGroupItem
                      key={iv.value}
                      value={iv.value}
                      disabled={!iv.supported}
                      className={cn(
                        'h-7 w-12 px-1 text-[11px] font-mono data-[state=off]:text-muted-foreground',
                        !iv.supported && 'opacity-35 line-through',
                      )}
                    >
                      {iv.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            ) : (
              <div>
                <IntervalEditor
                  intervals={decoratedIntervals}
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
