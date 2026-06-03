'use client'

import { forwardRef } from 'react'
import { cn } from '@eous/ui'
import type { IntervalItem } from './types'

interface IntervalPopupProps {
  items: IntervalItem[]
  onSelect: (value: string) => void
}

/**
 * Floating panel showing the remaining (hidden) intervals.
 * Renders directly below the toolbar — no portal, no backdrop.
 * The parent positions it via the relative container.
 */
export const IntervalPopup = forwardRef<HTMLDivElement, IntervalPopupProps>(
  function IntervalPopup({ items, onSelect }, ref) {
    if (items.length === 0) return null

    return (
      <div
        ref={ref}
        className="absolute left-0 top-full mt-1 z-50
          bg-popover border border-border rounded-md shadow-md
          p-2 flex flex-wrap gap-1 min-w-[200px]"
      >
        {items.map((iv) => (
          <button
            key={iv.value}
            onClick={() => onSelect(iv.value)}
            className={cn(
              'px-2 py-1 text-[10px] font-mono rounded transition-colors',
              'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            {iv.label}
          </button>
        ))}
      </div>
    )
  },
)
