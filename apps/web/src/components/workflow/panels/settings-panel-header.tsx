import { Loader2, Play, Variable, X } from 'lucide-react'
import { Button, cn } from '@eous/ui'

interface SettingsPanelHeaderProps {
  title: string
  inspectorOpen: boolean
  running: boolean
  onToggleInspector: () => void
  onRun: () => void
  onClose: () => void
}

function SettingsPanelHeader({
  title,
  inspectorOpen,
  running,
  onToggleInspector,
  onRun,
  onClose,
}: SettingsPanelHeaderProps) {
  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card/80 px-3">
      <div className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{title}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost-icon"
          size="xs"
          className={cn('w-6 px-0', inspectorOpen && 'bg-accent text-accent-foreground')}
          onClick={onToggleInspector}
          title="变量"
          aria-label="变量"
        >
          <Variable className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost-icon"
          size="xs"
          className="w-6 px-0"
          onClick={onRun}
          disabled={running}
          title="运行"
          aria-label="运行"
        >
          {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
        </Button>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export { SettingsPanelHeader }
export type { SettingsPanelHeaderProps }
