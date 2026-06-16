import { useCallback, useEffect, useState } from 'react'
import { LineStyle } from 'lightweight-charts'
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  Slider,
} from '@eous/ui'
import { GripVertical, Palette, Trash2 } from 'lucide-react'
import type { DrawingStyle, DrawingStrokeStyle } from '../core/line-tools-engine'

const COLOR_GROUPS = [
  ['#fee2e2', '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#991b1b'],
  ['#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c', '#9a3412'],
  ['#fef3c7', '#fde68a', '#fcd34d', '#fbbf24', '#f59e0b', '#d97706', '#b45309', '#92400e'],
  ['#fef9c3', '#fef08a', '#fde047', '#facc15', '#eab308', '#ca8a04', '#a16207', '#854d0e'],
  ['#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d', '#166534'],
  ['#ccfbf1', '#99f6e4', '#5eead4', '#2dd4bf', '#14b8a6', '#0d9488', '#0f766e', '#115e59'],
  ['#cffafe', '#a5f3fc', '#67e8f9', '#22d3ee', '#06b6d4', '#0891b2', '#0e7490', '#155e75'],
  ['#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af'],
  ['#ede9fe', '#ddd6fe', '#c4b5fd', '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6'],
  ['#fce7f3', '#fbcfe8', '#f9a8d4', '#f472b6', '#ec4899', '#db2777', '#be185d', '#9d174d'],
  ['#ffffff', '#f3f4f6', '#d1d5db', '#9ca3af', '#6b7280', '#374151', '#111827', '#000000'],
]
const COLOR_ROWS = Array.from({ length: 8 }, (_, shadeIndex) =>
  COLOR_GROUPS.map((group) => group[shadeIndex]),
)

const WIDTH_OPTIONS = [1, 2, 3, 4]

const STYLE_OPTIONS: { value: DrawingStrokeStyle; label: string; className: string }[] = [
  { value: LineStyle.Solid, label: 'Solid', className: 'border-t-2' },
  { value: LineStyle.Dashed, label: 'Dashed', className: 'border-t-2 border-dashed' },
  { value: LineStyle.Dotted, label: 'Dotted', className: 'border-t-2 border-dotted' },
]

const TOOLBAR_BUTTON_CLASS =
  'size-8 min-w-8 shrink-0 rounded-none px-0 py-0 text-foreground hover:text-primary'

interface DrawingStyleToolbarProps {
  visible: boolean
  style: DrawingStyle | null
  onStyleChange: (updates: Partial<DrawingStyle>) => void
  onDelete: () => void
}

export function DrawingStyleToolbar({
  visible,
  style,
  onStyleChange,
  onDelete,
}: DrawingStyleToolbarProps) {
  const [position, setPosition] = useState({ x: 72, y: 16 })
  const [colorOpen, setColorOpen] = useState(false)

  useEffect(() => {
    if (!visible) {
      setPosition({ x: 72, y: 16 })
      setColorOpen(false)
    }
  }, [visible])

  const handleDragStart = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault()
      const startX = event.clientX
      const startY = event.clientY
      const startPosition = position

      function handlePointerMove(moveEvent: PointerEvent) {
        setPosition({
          x: Math.max(8, startPosition.x + moveEvent.clientX - startX),
          y: Math.max(8, startPosition.y + moveEvent.clientY - startY),
        })
      }

      function handlePointerUp() {
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)
      }

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
    },
    [position],
  )

  if (!visible || !style) return null

  return (
    <div
      className="absolute z-20 flex h-8 items-center overflow-hidden rounded-md border border-border bg-background shadow-lg"
      style={{ left: position.x, top: position.y }}
    >
      <Button
        variant="ghost-icon"
        size="sm"
        className={cn(TOOLBAR_BUTTON_CLASS, 'w-7 min-w-7 cursor-move')}
        onPointerDown={handleDragStart}
        aria-label="Move drawing toolbar"
      >
        <GripVertical size={13} />
      </Button>

      <Separator orientation="vertical" className="h-5" />

      <Popover open={colorOpen} onOpenChange={setColorOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost-icon"
            size="sm"
            className={TOOLBAR_BUTTON_CLASS}
            aria-label="Drawing color"
          >
            <span
              className="size-3.5 rounded-sm border border-border shadow-[inset_0_0_0_1px_rgb(0_0_0/0.18)]"
              style={{ backgroundColor: style.color, opacity: style.opacity }}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" side="bottom" sideOffset={6} className="w-auto p-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Palette size={12} />
              <span>Color</span>
            </div>

            <div className="flex w-[216px] flex-col gap-1">
              {COLOR_ROWS.map((row, rowIndex) => (
                <div key={rowIndex} className="flex gap-1">
                  {row.map((color) => {
                    const selected = color.toLowerCase() === style.color.toLowerCase()
                    return (
                      <button
                        key={color}
                        type="button"
                        className={cn(
                          'size-4 rounded-[3px] border border-border ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                          selected && 'ring-2 ring-primary',
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() => onStyleChange({ color })}
                        aria-label={`Set line color ${color}`}
                      />
                    )
                  })}
                </div>
              ))}
            </div>

            <Separator />

            <div className="flex w-[216px] items-center gap-2">
              <Slider
                className="flex-1"
                min={10}
                max={100}
                step={5}
                value={[Math.round(style.opacity * 100)]}
                onValueChange={([value]) => onStyleChange({ opacity: value / 100 })}
              />
              <span className="w-7 text-right text-xs tabular-nums text-muted-foreground">
                {Math.round(style.opacity * 100)}%
              </span>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost-icon"
            size="sm"
            className={TOOLBAR_BUTTON_CLASS}
            aria-label="Line width"
          >
            <span
              className="block w-5 rounded-full bg-current"
              style={{ height: Math.max(2, style.width) }}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="bottom" sideOffset={6} className="min-w-24">
          <div className="flex flex-col gap-0.5">
            {WIDTH_OPTIONS.map((width) => (
              <DropdownMenuItem
                key={width}
                className={cn(
                  'h-7 justify-center px-2 py-0',
                  style.width === width && 'bg-primary/15 text-primary focus:bg-primary/15',
                )}
                onSelect={() => onStyleChange({ width })}
              >
                <span
                  className="block w-10 rounded-full bg-current"
                  style={{ height: Math.max(2, width) }}
                />
              </DropdownMenuItem>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost-icon"
            size="sm"
            className={TOOLBAR_BUTTON_CLASS}
            aria-label="Line style"
          >
            <span
              className={cn(
                'block w-5 border-t-2 border-current',
                style.style !== LineStyle.Solid && 'border-dashed',
              )}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="bottom" sideOffset={6} className="min-w-28">
          <div className="flex flex-col gap-0.5">
            {STYLE_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                className={cn(
                  'h-7 justify-center px-2 py-0',
                  style.style === option.value && 'bg-primary/15 text-primary focus:bg-primary/15',
                )}
                onSelect={() => onStyleChange({ style: option.value })}
              >
                <span className={cn('block w-10 border-current', option.className)} />
              </DropdownMenuItem>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost-icon"
        size="sm"
        className={cn(TOOLBAR_BUTTON_CLASS, 'text-destructive hover:text-destructive')}
        onClick={onDelete}
        aria-label="Delete selected drawing"
      >
        <Trash2 size={13} />
      </Button>
    </div>
  )
}
