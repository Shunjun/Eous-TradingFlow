import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@eous/ui'
import { MousePointer2, Shapes, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { LINE_TOOL_GROUPS } from '../line-tools/registry'
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
  tools: _tools,
  onSelectTool,
  onDeleteSelected,
  hasSelected,
}: LineToolsSidebarProps) {
  const activeGroup = LINE_TOOL_GROUPS.find((group) =>
    group.tools.some((tool) => tool.type === activeTool),
  )
  const activeDefinition = activeGroup?.tools.find((tool) => tool.type === activeTool)
  const DrawingIcon = activeDefinition?.icon ?? Shapes

  return (
    <div className="flex flex-col items-center w-10 py-1.5 border-r border-border shrink-0 gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost-icon"
            className={cn(activeTool === POINTER_TOOL.id && 'bg-primary/15 text-primary')}
            onClick={() => onSelectTool(POINTER_TOOL.id)}
          >
            <POINTER_TOOL.icon size={14} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{POINTER_TOOL.label}</TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost-icon"
                className={cn(activeDefinition && 'bg-primary/15 text-primary')}
              >
                <DrawingIcon size={14} />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{activeDefinition?.label ?? 'Drawing tools'}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent side="right" align="start" className="min-w-[190px]">
          <DropdownMenuLabel>Drawing Tools</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {LINE_TOOL_GROUPS.map((group) => {
            const groupIsActive = group.id === activeGroup?.id
            return (
              <DropdownMenuSub key={group.id}>
                <DropdownMenuSubTrigger
                  className={cn(groupIsActive && 'bg-primary/10 text-primary')}
                >
                  <Shapes size={14} />
                  <span>{group.label}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[180px]">
                  <DropdownMenuGroup>
                    {group.tools.map((tool) => {
                      const Icon = tool.icon
                      const isActive = activeTool === tool.type
                      return (
                        <DropdownMenuItem
                          key={tool.type}
                          className={cn(isActive && 'bg-primary/10 text-primary')}
                          onClick={() => onSelectTool(tool.type)}
                        >
                          <Icon size={14} />
                          <span>{tool.label}</span>
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex-1" />

      {hasSelected && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost-icon"
              className="text-red-400 hover:text-red-300"
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
