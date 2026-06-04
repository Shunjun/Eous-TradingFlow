'use client'

import { useState, useCallback, useRef, type DragEvent } from 'react'
import { cn, Button, Separator } from '@eous/ui'
import { GripVertical, Check } from 'lucide-react'
import type { IntervalItem } from './types'

interface IntervalEditorProps {
  /** The full ordered list of intervals (visible + hidden, with visible flags) */
  intervals: IntervalItem[]
  /** Called with the new full ordered list when user clicks "完成" */
  onSave: (intervals: IntervalItem[]) => void
  onCancel: () => void
  /** Values the provider doesn't support — shown greyed out but still draggable */
  unsupportedValues: string[]
}

/**
 * Editor overlay with two drag-and-drop zones.
 *
 * ── Architecture ──
 * A single ordered array `items` is the source of truth.
 * - Visible zone = items where _visible === true
 * - Hidden zone = items where _visible === false
 *
 * Drag-and-drop operates on flat indices in `items`.
 * When dropping from one zone into another, the `_visible` flag toggles.
 *
 * ── Drop zones ──
 * Each zone renders gap-based drop targets:
 *   [dropzone before first item]
 *   Item A
 *   [dropzone after A]
 *   Item B
 *   [dropzone after B]
 *   ...
 *
 * The dropzone "after item X" inserts at flat-index(X) + 1.
 * This naturally handles hidden interval rollover:
 *   Full: [A, C(hidden), B, D]. Drag D to after A → [A, D, C, B].
 *
 * ── Hidden interval rollover ──
 * Example: C is hidden, full sequence is [A, C, B, D].
 * User drags D to after A (visible zone gap between A and B).
 * Since "after A" = flat-index(A) + 1 = position 1,
 * D inserts at position 1 → [A, D, C, B]. C stays hidden between D and B.
 * ✓ Correct.
 */
export function IntervalEditor({
  intervals: initialIntervals,
  onSave,
  onCancel,
  unsupportedValues,
}: IntervalEditorProps) {
  const [items, setItems] = useState(() => reindex(initialIntervals))
  const [dragItem, setDragItem] = useState<DataItem | null>(null)
  const [hoveredDropZone, setHoveredDropZone] = useState<string | null>(null)

  const dragImageRef = useRef<HTMLElement | null>(null)

  // Split by visibility
  const visibleItems = items.filter((iv) => iv._visible)
  const hiddenItems = items.filter((iv) => !iv._visible)

  // ── Helpers ──

  /** Find the flat-array insertion index for a drop zone */
  function resolveInsertIndex(dropZoneId: string): number {
    if (dropZoneId === 'visible-top') return 0

    if (dropZoneId.startsWith('visible-after-')) {
      const value = dropZoneId.replace('visible-after-', '')
      const idx = items.findIndex((iv) => iv.value === value)
      return idx >= 0 ? idx + 1 : items.length
    }

    if (dropZoneId.startsWith('visible-before-')) {
      const value = dropZoneId.replace('visible-before-', '')
      const idx = items.findIndex((iv) => iv.value === value)
      return idx >= 0 ? idx : items.length
    }

    if (dropZoneId === 'visible-bottom') {
      const lastVisible = findLastIndex(items, (iv) => iv._visible)
      return lastVisible >= 0 ? lastVisible + 1 : 0
    }

    if (dropZoneId === 'hidden-top') {
      const firstHidden = items.findIndex((iv) => !iv._visible)
      return firstHidden >= 0 ? firstHidden : items.length
    }

    if (dropZoneId.startsWith('hidden-after-')) {
      const value = dropZoneId.replace('hidden-after-', '')
      const idx = items.findIndex((iv) => iv.value === value)
      return idx >= 0 ? idx + 1 : items.length
    }

    if (dropZoneId === 'hidden-bottom') return items.length

    return items.length
  }

  /** Determine if dropping into this zone should set visible = true */
  function resolveTargetVisible(dropZoneId: string): boolean {
    return dropZoneId.startsWith('visible-')
  }

  // ── Drag handlers ──

  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, item: DataItem) => {
    setDragItem(item)
    e.dataTransfer.effectAllowed = 'move'

    // Custom drag image
    const el = e.currentTarget.cloneNode(true) as HTMLElement
    el.style.position = 'absolute'
    el.style.top = '-9999px'
    el.style.opacity = '0.8'
    el.style.padding = '4px 8px'
    el.style.fontSize = '10px'
    el.style.fontFamily = 'monospace'
    el.style.background = 'hsl(var(--popover))'
    el.style.border = '1px solid hsl(var(--border))'
    el.style.borderRadius = '4px'
    el.style.pointerEvents = 'none'
    document.body.appendChild(el)
    e.dataTransfer.setDragImage(el, 20, 12)
    dragImageRef.current = el
  }, [])

  const handleDragEnd = useCallback(() => {
    setDragItem(null)
    setHoveredDropZone(null)
    if (dragImageRef.current) {
      document.body.removeChild(dragImageRef.current)
      dragImageRef.current = null
    }
  }, [])

  const handleDropZoneDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>, dropZoneId: string) => {
      e.preventDefault()
      if (dragItem) {
        setHoveredDropZone(dropZoneId)
      }
    },
    [dragItem],
  )

  const handleDropZoneDragLeave = useCallback(() => {
    setHoveredDropZone(null)
  }, [])

  const handleDropZoneDrop = useCallback(
    (e: DragEvent<HTMLDivElement>, dropZoneId: string) => {
      e.preventDefault()
      e.stopPropagation()

      if (!dragItem) return

      const insertAt = resolveInsertIndex(dropZoneId)
      const targetVisible = resolveTargetVisible(dropZoneId)
      const draggedValue = dragItem.value

      // Find current index of the dragged item
      const currentIndex = items.findIndex((iv) => iv.value === draggedValue)
      if (currentIndex === -1) return

      const next = [...items]
      const [moved] = next.splice(currentIndex, 1)

      // Adjust insert index after removal
      let finalIndex = insertAt
      if (currentIndex < insertAt) {
        finalIndex = insertAt - 1
      }

      // Clamp
      finalIndex = Math.max(0, Math.min(finalIndex, next.length))

      next.splice(finalIndex, 0, { ...moved, _visible: targetVisible })
      setItems(reindex(next))
      setDragItem(null)
      setHoveredDropZone(null)
    },
    [dragItem, items],
  )

  // ── Drop zone renders ──

  const DropZone = ({ id, className = '' }: { id: string; className?: string }) => {
    const isHovered = hoveredDropZone === id
    return (
      <div
        onDragOver={(e) => handleDropZoneDragOver(e, id)}
        onDragLeave={handleDropZoneDragLeave}
        onDrop={(e) => handleDropZoneDrop(e, id)}
        className={cn(
          'transition-all duration-100 rounded-sm',
          isHovered ? 'h-1 bg-primary/60 my-0.5' : 'h-0.5 my-0',
          className,
        )}
      />
    )
  }

  const renderItem = (item: DataItem) => {
    const isDragging = dragItem?.value === item.value
    const isUnsupported = unsupportedValues.includes(item.value)

    return (
      <div
        key={item._id}
        draggable
        onDragStart={(e) => handleDragStart(e, item)}
        onDragEnd={handleDragEnd}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono cursor-grab active:cursor-grabbing select-none transition-colors',
          isDragging && 'opacity-30',
          isUnsupported
            ? 'text-muted-foreground/40 line-through'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/30',
        )}
      >
        <GripVertical size={10} className="shrink-0 text-muted-foreground/30" />
        <span>{item.label}</span>
        {isUnsupported && (
          <span className="text-[8px] text-muted-foreground/40 ml-auto">unsupported</span>
        )}
      </div>
    )
  }

  // ── Render ──
  return (
    <div className="absolute left-0 top-full mt-1 z-50 min-w-[220px]">
      <div className="bg-popover border border-border rounded-md shadow-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-[10px] font-mono text-muted-foreground">Edit intervals</span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              onClick={onCancel}
              className="px-2 py-0.5 text-[10px] font-mono text-muted-foreground
                hover:text-foreground rounded transition-colors"
            >
              Cancel
            </Button>
            <Button
              onClick={() => onSave(items.map(stripInternal))}
              className="px-2 py-0.5 text-[10px] font-mono text-primary
                hover:bg-primary/10 rounded transition-colors flex items-center gap-1"
            >
              <Check size={10} />
              Done
            </Button>
          </div>
        </div>

        {/* ── Visible zone ── */}
        <div className={cn('py-1 px-1 min-h-[32px]', dragItem && 'bg-primary/[0.03]')}>
          <div className="text-[8px] text-muted-foreground/40 px-2 pb-1 font-mono uppercase tracking-wider">
            Toolbar
          </div>

          {visibleItems.length === 0 && !dragItem && (
            <div className="text-[9px] text-muted-foreground/40 text-center py-2 font-mono">
              Drag intervals here to show
            </div>
          )}

          {visibleItems.length > 0 && <DropZone id="visible-top" />}

          {visibleItems.map((item) => (
            <div key={item._id}>
              {renderItem(item)}
              <DropZone id={`visible-after-${item.value}`} />
            </div>
          ))}

          {/* Bottom drop zone for visible area — only show when empty or during drag */}
          {(hoveredDropZone === 'visible-bottom' || dragItem !== null) && (
            <DropZone id="visible-bottom" />
          )}
        </div>

        {/* Divider */}
        <Separator className="mx-2" />

        {/* ── Hidden zone ── */}
        <div className={cn('py-1 px-1 min-h-[32px]', dragItem && 'bg-muted/20')}>
          <div className="text-[8px] text-muted-foreground/40 px-2 pb-1 font-mono uppercase tracking-wider">
            Hidden
          </div>

          {hiddenItems.length === 0 && !dragItem && (
            <div className="text-[9px] text-muted-foreground/40 text-center py-2 font-mono">
              No hidden intervals
            </div>
          )}

          {hiddenItems.length > 0 && <DropZone id="hidden-top" />}

          {hiddenItems.map((item) => (
            <div key={item._id}>
              {renderItem(item)}
              <DropZone id={`hidden-after-${item.value}`} />
            </div>
          ))}

          {hiddenItems.length === 0 && dragItem !== null && <DropZone id="hidden-top" />}

          <DropZone id="hidden-bottom" />
        </div>
      </div>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

type DataItem = IntervalItem & Internals

let _idCounter = 0

interface Internals {
  _id: number
  _visible: boolean
}

function reindex(list: IntervalItem[]): DataItem[] {
  return list.map((iv) => ({
    ...iv,
    _id: ++_idCounter,
    _visible: iv.visible,
  }))
}

function stripInternal(iv: DataItem): IntervalItem {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, _visible, ...rest } = iv
  return { ...rest, visible: _visible }
}

function findLastIndex<T>(arr: T[], pred: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i])) return i
  }
  return -1
}
