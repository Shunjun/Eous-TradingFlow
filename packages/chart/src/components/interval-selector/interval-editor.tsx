'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn, Button, Separator } from '@eous/ui'
import { GripVertical, Check } from 'lucide-react'
import type { IntervalItem } from './types'

// ── Types ───────────────────────────────────────────────────────────────────

interface IntervalEditorProps {
  intervals: IntervalItem[]
  onSave: (intervals: IntervalItem[]) => void
  onCancel: () => void
  unsupportedValues: string[]
}

interface EditorItem {
  id: string
  label: string
  value: string
  visible: boolean
  supported: boolean
}

// ── Sortable item ───────────────────────────────────────────────────────────

function SortableIntervalItem({
  item,
  unsupportedValues,
}: {
  item: EditorItem
  unsupportedValues: string[]
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const isUnsupported = unsupportedValues.includes(item.value)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono select-none transition-colors',
        isDragging && 'opacity-30',
        isUnsupported
          ? 'text-muted-foreground/40 line-through'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/30',
      )}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical size={10} className="text-muted-foreground/30" />
      </button>
      <span>{item.label}</span>
      {isUnsupported && (
        <span className="text-[8px] text-muted-foreground/40 ml-auto">unsupported</span>
      )}
    </div>
  )
}

// ── Drag overlay item ───────────────────────────────────────────────────────

function DragOverlayItem({ item }: { item: EditorItem }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono bg-popover border border-border shadow-md opacity-80">
      <GripVertical size={10} className="shrink-0 text-muted-foreground/30" />
      <span>{item.label}</span>
    </div>
  )
}

// ── Zone wrapper ────────────────────────────────────────────────────────────

function DroppableZone({
  id,
  label,
  items,
  emptyText,
  unsupportedValues,
  isActive,
}: {
  id: string
  label: string
  items: EditorItem[]
  emptyText: string
  unsupportedValues: string[]
  isActive: boolean
}) {
  return (
    <div className={cn('py-1 px-1 min-h-[32px]', isActive && 'bg-primary/[0.03]')}>
      <div className="text-[8px] text-muted-foreground/40 px-2 pb-1 font-mono uppercase tracking-wider">
        {label}
      </div>

      {items.length === 0 && (
        <div className="text-[9px] text-muted-foreground/40 text-center py-2 font-mono">
          {emptyText}
        </div>
      )}

      <SortableContext
        items={items.map((iv) => iv.id)}
        strategy={verticalListSortingStrategy}
        id={id}
      >
        {items.map((item) => (
          <SortableIntervalItem key={item.id} item={item} unsupportedValues={unsupportedValues} />
        ))}
      </SortableContext>
    </div>
  )
}

// ── Main editor ─────────────────────────────────────────────────────────────

export function IntervalEditor({
  intervals: initialIntervals,
  onSave,
  onCancel,
  unsupportedValues,
}: IntervalEditorProps) {
  const [items, setItems] = useState<EditorItem[]>(() =>
    initialIntervals.map((iv) => ({
      id: iv.value,
      label: iv.label,
      value: iv.value,
      visible: iv.visible,
      supported: iv.supported,
    })),
  )

  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
  )

  const visibleItems = useMemo(() => items.filter((iv) => iv.visible), [items])
  const hiddenItems = useMemo(() => items.filter((iv) => !iv.visible), [items])
  const activeItem = useMemo(
    () => items.find((iv) => iv.id === activeId) ?? null,
    [items, activeId],
  )

  // Find which zone an item belongs to
  const findZone = useCallback(
    (itemId: string): 'visible' | 'hidden' => {
      const item = items.find((iv) => iv.id === itemId)
      return item?.visible ? 'visible' : 'hidden'
    },
    [items],
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }, [])

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event
      if (!over) return

      const activeItemId = String(active.id)
      const overId = String(over.id)

      const activeZone = findZone(activeItemId)
      const overItem = items.find((iv) => iv.id === overId)
      const overZone = overItem ? (overItem.visible ? 'visible' : 'hidden') : overId

      // Same zone — let sortable handle reordering
      if (activeZone === overZone) return

      // Cross-zone: toggle visibility of the dragged item
      setItems((prev) =>
        prev.map((iv) => (iv.id === activeItemId ? { ...iv, visible: !iv.visible } : iv)),
      )
    },
    [findZone, items],
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeItemId = String(active.id)
    const overId = String(over.id)

    if (activeItemId === overId) return

    setItems((prev) => {
      const activeItem = prev.find((iv) => iv.id === activeItemId)
      const overItem = prev.find((iv) => iv.id === overId)

      if (!activeItem || !overItem) return prev

      // Same zone: reorder
      if (activeItem.visible === overItem.visible) {
        const sameZone = prev.filter((iv) => iv.visible === activeItem.visible)
        const otherZone = prev.filter((iv) => iv.visible !== activeItem.visible)
        const oldIndex = sameZone.findIndex((iv) => iv.id === activeItemId)
        const newIndex = sameZone.findIndex((iv) => iv.id === overId)
        const reordered = arrayMove(sameZone, oldIndex, newIndex)

        return activeItem.visible ? [...reordered, ...otherZone] : [...otherZone, ...reordered]
      }

      // Different zones: already toggled in onDragOver, just reorder in target zone
      const targetVisible = overItem.visible
      const targetZone = prev.filter((iv) => iv.visible === targetVisible && iv.id !== activeItemId)
      const sourceZone = prev.filter((iv) => iv.visible !== targetVisible && iv.id !== activeItemId)
      const overIndex = targetZone.findIndex((iv) => iv.id === overId)
      const insertAt = overIndex >= 0 ? overIndex : targetZone.length

      targetZone.splice(insertAt, 0, { ...activeItem, visible: targetVisible })

      return targetVisible ? [...targetZone, ...sourceZone] : [...sourceZone, ...targetZone]
    })
  }, [])

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
  }, [])

  const handleSave = useCallback(() => {
    const result: IntervalItem[] = items.map((iv) => ({
      label: iv.label,
      value: iv.value,
      visible: iv.visible,
      supported: iv.supported,
    }))
    onSave(result)
  }, [items, onSave])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
        <span className="text-[10px] font-mono text-muted-foreground">Edit intervals</span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="xs"
            onClick={onCancel}
            className="text-[10px] font-mono text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            size="xs"
            onClick={handleSave}
            className="text-[10px] font-mono text-primary hover:bg-primary/10 flex items-center gap-1"
          >
            <Check size={10} />
            Done
          </Button>
        </div>
      </div>

      {/* Visible zone */}
      <DroppableZone
        id="visible"
        label="Toolbar"
        items={visibleItems}
        emptyText="Drag intervals here to show"
        unsupportedValues={unsupportedValues}
        isActive={activeId !== null}
      />

      <Separator className="mx-2" />

      {/* Hidden zone */}
      <DroppableZone
        id="hidden"
        label="Hidden"
        items={hiddenItems}
        emptyText="No hidden intervals"
        unsupportedValues={unsupportedValues}
        isActive={activeId !== null}
      />

      <DragOverlay dropAnimation={null}>
        {activeItem ? <DragOverlayItem item={activeItem} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
