import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@eous/ui'
import { X } from 'lucide-react'

// ── Types ───────────────────────────────────────────────────────────────────

interface ResizablePanelProps {
  /** Panel title displayed in header */
  title?: string
  /** Initial width in pixels */
  defaultWidth?: number
  /** Minimum allowed width */
  minWidth?: number
  /** Maximum allowed width */
  maxWidth?: number
  /** Callback when close button is clicked */
  onClose?: () => void
  /** Whether panel is open/visible */
  open?: boolean
  /** Content to render inside the panel */
  children?: React.ReactNode
}

// ── Component ───────────────────────────────────────────────────────────────

export function ResizablePanel({
  title,
  defaultWidth = 320,
  minWidth = 200,
  maxWidth = 600,
  onClose,
  open = false,
  children,
}: ResizablePanelProps) {
  const [width, setWidth] = useState(defaultWidth)
  const [isDragging, setIsDragging] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(true)
      startXRef.current = e.clientX
      startWidthRef.current = width
    },
    [width],
  )

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startXRef.current - e.clientX
      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidthRef.current + delta))
      setWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    // Add pointer-events: none to chart area during drag
    const chartContainer = document.querySelector('[data-chart-container]') as HTMLElement | null
    if (chartContainer) {
      chartContainer.style.pointerEvents = 'none'
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      if (chartContainer) {
        chartContainer.style.pointerEvents = ''
      }
    }
  }, [isDragging, minWidth, maxWidth])

  return (
    <div
      ref={panelRef}
      className={cn(
        'relative flex shrink-0 border-l border-border bg-background',
        'transition-all duration-200 ease-in-out',
      )}
      style={{
        width: open ? width : 0,
        minWidth: open ? width : 0,
      }}
    >
      {/* Drag handle */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1 cursor-col-resize',
          'hover:bg-primary/50 active:bg-primary/60',
          'transition-colors duration-150',
          isDragging && 'bg-primary/50',
        )}
        onMouseDown={handleMouseDown}
      />

      {/* Panel content */}
      {open && (
        <div className="flex flex-col h-full w-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
            <span className="text-xs font-mono font-medium truncate">{title ?? '设置'}</span>
            {onClose && (
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted/50"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
        </div>
      )}
    </div>
  )
}
