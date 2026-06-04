import { Button } from '@eous/ui'
import { X } from 'lucide-react'

interface ResizablePanelHeaderProps {
  title: string
  onClose: () => void
}

export function ResizablePanelHeader({ title, onClose }: ResizablePanelHeaderProps) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
      <span className="truncate font-mono text-xs font-medium">{title}</span>
      <Button
        variant="ghost"
        size="xs"
        onClick={onClose}
        className="size-6 rounded p-0.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      >
        <X size={14} />
      </Button>
    </div>
  )
}
