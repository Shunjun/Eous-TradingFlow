import { Button, cn, Tooltip, TooltipTrigger, TooltipContent } from '@eous/ui'
import { MousePointer2, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { LineToolDefinition } from '../line-tools/types'

interface ToolItem {
  id: string
  label: string
  icon: LucideIcon
}

const POINTER_TOOL: ToolItem = {
  id: 'none',
  label: 'Select',
  icon: MousePointer2,
}

interface LineToolsSidebarProps {
  activeTool: string
  tools: LineToolDefinition[]
  onSelectTool: (id: string) => void
  onDeleteSelected: () => void
  hasSelected: boolean
}

export function LineToolsSidebar({
  activeTool,
  tools,
  onSelectTool,
  onDeleteSelected,
  hasSelected,
}: LineToolsSidebarProps) {
  const allTools: ToolItem[] = [
    POINTER_TOOL,
    ...tools.map((t) => ({ id: t.type, label: t.label, icon: t.icon })),
  ]

  return (
    <div className="flex flex-col items-center w-10 py-1.5 border-r border-border shrink-0 gap-0.5">
      {/* Pointer + drawing tools */}
      {allTools.map((tool) => {
        const Icon = tool.icon
        return (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost-icon"
                size="icon"
                className={cn('h-8 w-8', activeTool === tool.id && 'bg-primary/15 text-primary')}
                onClick={() => onSelectTool(tool.id)}
              >
                <Icon size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{tool.label}</TooltipContent>
          </Tooltip>
        )
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Delete selected */}
      {hasSelected && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost-icon"
              size="icon"
              className="h-8 w-8 text-red-400 hover:text-red-300"
              onClick={onDeleteSelected}
            >
              <Trash2 size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete selected</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
