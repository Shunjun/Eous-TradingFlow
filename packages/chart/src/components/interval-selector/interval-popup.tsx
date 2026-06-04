'use client'

import { cn, Button, PopoverContent } from '@eous/ui'
import type { IntervalItem } from './types'

interface IntervalPopupProps {
  items: IntervalItem[]
  onSelect: (value: string) => void
}

export function IntervalPopup({ items, onSelect }: IntervalPopupProps) {
  if (items.length === 0) return null

  return (
    <PopoverContent align="start" sideOffset={4} className="w-auto p-2 flex flex-wrap gap-1">
      {items.map((iv) => (
        <Button
          variant="ghost"
          key={iv.value}
          onClick={() => onSelect(iv.value)}
          className={cn(
            'px-2 py-1 text-[10px] font-mono rounded transition-colors',
            'text-muted-foreground hover:text-foreground hover:bg-muted/50',
          )}
        >
          {iv.label}
        </Button>
      ))}
    </PopoverContent>
  )
}
