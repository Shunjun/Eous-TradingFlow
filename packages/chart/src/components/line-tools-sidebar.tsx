import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@eous/ui'
import { ChartNoAxesCombined, MessageSquare, MousePointer2, PencilLine, Ruler } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { LINE_TOOL_GROUPS } from '../line-tools/registry'

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

const GROUP_ICONS: Record<string, LucideIcon> = {
  lines: PencilLine,
  levels: Ruler,
  annotations: MessageSquare,
  fibonacci: ChartNoAxesCombined,
}

interface LineToolsSidebarProps {
  activeTool: string
  onSelectTool: (id: string) => void
}

export function LineToolsSidebar({ activeTool, onSelectTool }: LineToolsSidebarProps) {
  const activeGroup = LINE_TOOL_GROUPS.find((group) =>
    group.tools.some((tool) => tool.type === activeTool),
  )

  return (
    <div className="flex w-11 shrink-0 flex-col items-center gap-0.5 border-r border-border bg-background py-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost-icon"
            className={cn(
              'h-7 w-7 px-0',
              activeTool === POINTER_TOOL.id && 'bg-primary/15 text-primary',
            )}
            onClick={() => onSelectTool(POINTER_TOOL.id)}
            aria-label={POINTER_TOOL.label}
          >
            <POINTER_TOOL.icon size={14} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {POINTER_TOOL.label}
        </TooltipContent>
      </Tooltip>

      {LINE_TOOL_GROUPS.map((group) => {
        const groupIsActive = group.id === activeGroup?.id
        const activeDefinition = group.tools.find((tool) => tool.type === activeTool)
        const GroupIcon = activeDefinition?.icon ?? GROUP_ICONS[group.id] ?? PencilLine

        return (
          <DropdownMenu key={group.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost-icon"
                    className={cn('h-7 w-7 px-0', groupIsActive && 'bg-primary/15 text-primary')}
                    aria-label={activeDefinition?.label ?? group.label}
                  >
                    <GroupIcon size={14} />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {activeDefinition?.label ?? group.label}
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent side="right" align="start" className="min-w-[190px]">
              <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
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
            </DropdownMenuContent>
          </DropdownMenu>
        )
      })}

      <div className="flex-1" />
    </div>
  )
}
