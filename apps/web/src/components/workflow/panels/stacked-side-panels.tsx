import { Children, type ReactNode } from 'react'
import { Sheet, cn } from '@eous/ui'

interface StackedSidePanelsProps {
  open: boolean
  children: ReactNode
}

function StackedSidePanels({ open, children }: StackedSidePanelsProps) {
  if (!open) return null
  const panels = Children.toArray(children)

  return (
    <Sheet modal={false} open={open} onOpenChange={() => {}}>
      <div className="pointer-events-auto flex h-full min-h-0 flex-row-reverse items-stretch gap-3">
        {panels.map((panel, index) => (
          <div
            key={index}
            className="relative flex h-full min-h-0"
            style={{ zIndex: panels.length - index }}
          >
            {panel}
          </div>
        ))}
      </div>
    </Sheet>
  )
}

function stackedPanelClassName(width: string) {
  return cn(
    'h-full min-h-0 overflow-hidden rounded-lg border border-border bg-card/95 shadow-lg backdrop-blur',
    width,
  )
}

export { StackedSidePanels, stackedPanelClassName }
