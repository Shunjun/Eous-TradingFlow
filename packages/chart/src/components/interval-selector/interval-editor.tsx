'use client'

import { useState, useCallback, useMemo } from 'react'
import { cn, Button } from '@eous/ui'
import { Check } from 'lucide-react'
import type { IntervalItem } from './types'
import { compareIntervalsAsc } from '../../utils/interval'

interface IntervalEditorProps {
  intervals: IntervalItem[]
  onSave: (intervals: IntervalItem[]) => void | Promise<void>
  onCancel: () => void
  unsupportedValues: string[]
}

function IntervalTile({
  item,
  unsupported,
  onToggle,
}: {
  item: IntervalItem
  unsupported: boolean
  onToggle: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      disabled={unsupported}
      onClick={onToggle}
      className={cn(
        'relative h-7 w-12 px-1 justify-center rounded border text-[11px] font-mono transition-colors',
        item.visible
          ? 'border-primary/70 bg-primary/5 text-foreground hover:bg-primary/10'
          : 'border-border/70 text-muted-foreground hover:border-muted-foreground/45 hover:text-foreground hover:bg-muted/30',
        unsupported &&
          'border-border/40 text-muted-foreground/35 line-through hover:bg-transparent',
      )}
    >
      {item.label}
      {item.visible && (
        <span className="absolute -right-px -top-px flex h-3.5 w-3.5 items-center justify-center rounded-bl border-b border-l border-primary/60 bg-primary text-primary-foreground">
          <Check className="size-2.5" strokeWidth={2.4} />
        </span>
      )}
    </Button>
  )
}

export function IntervalEditor({
  intervals: initialIntervals,
  onSave,
  onCancel,
  unsupportedValues,
}: IntervalEditorProps) {
  const [items, setItems] = useState<IntervalItem[]>(() =>
    initialIntervals
      .map((item) => ({ ...item }))
      .sort((a, b) => compareIntervalsAsc(a.value, b.value)),
  )
  const unsupported = useMemo(() => new Set(unsupportedValues), [unsupportedValues])

  const handleToggle = useCallback((value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.value === value ? { ...item, visible: !item.visible } : item)),
    )
  }, [])

  const handleSave = useCallback(async () => {
    await onSave(items)
  }, [items, onSave])

  return (
    <div>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-[10px] font-mono text-muted-foreground">Edit intervals</span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="xs"
            onClick={onCancel}
            className="h-6 text-[10px] font-mono text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            size="xs"
            onClick={handleSave}
            className="h-6 text-[10px] font-mono flex items-center gap-1"
          >
            <Check className="size-3.5" />
            Done
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(5,3rem)] gap-1.5 p-2">
        {items.map((item) => (
          <IntervalTile
            key={item.value}
            item={item}
            unsupported={unsupported.has(item.value)}
            onToggle={() => handleToggle(item.value)}
          />
        ))}
      </div>
    </div>
  )
}
