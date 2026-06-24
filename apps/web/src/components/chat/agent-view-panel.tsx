import { Button } from '@eous/ui'
import { Eye, X } from 'lucide-react'
import { useChatStore } from './store'

export function AgentViewPanel() {
  const setViewOpen = useChatStore((state) => state.setViewOpen)

  return (
    <aside className="flex h-full flex-col border-l border-border">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div>
          <div className="text-sm font-semibold">Agent View</div>
          <div className="text-xs text-muted-foreground">Workflow, web, and tool output</div>
        </div>
        <Button
          size="sm"
          variant="ghost-icon"
          onClick={() => setViewOpen(false)}
          title="Close view"
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
        <div>
          <Eye className="mx-auto mb-3 size-8 opacity-50" />
          <div className="font-medium text-foreground">No view open</div>
          <p className="mt-1 max-w-xs text-xs leading-5">
            Future MCP tools can open workflows, webpages, charts, or reports here.
          </p>
        </div>
      </div>
    </aside>
  )
}
