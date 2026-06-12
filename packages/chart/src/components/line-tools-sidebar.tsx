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
import { useCallback, useState } from 'react'
import { GripVertical, MousePointer2, Shapes, Trash2 } from 'lucide-react'
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
  const [width, setWidth] = useState(48)
  const showLabels = width >= 96

  const handleResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      const startX = event.clientX
      const startWidth = width

      function handlePointerMove(moveEvent: PointerEvent) {
        const nextWidth = Math.min(180, Math.max(44, startWidth + moveEvent.clientX - startX))
        setWidth(nextWidth)
      }

      function handlePointerUp() {
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)
      }

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
    },
    [width],
  )

  return (
    <div
      className="relative flex shrink-0 flex-col gap-0.5 border-r border-border py-1.5"
      style={{ width }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost-icon"
            className={cn(
              'mx-1 justify-start',
              !showLabels && 'justify-center px-0',
              activeTool === POINTER_TOOL.id && 'bg-primary/15 text-primary',
            )}
            onClick={() => onSelectTool(POINTER_TOOL.id)}
          >
            <POINTER_TOOL.icon size={14} />
            {showLabels && <span className="truncate text-xs">{POINTER_TOOL.label}</span>}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{POINTER_TOOL.label}</TooltipContent>
      </Tooltip>

      {LINE_TOOL_GROUPS.map((group) => {
        const groupIsActive = group.id === activeGroup?.id
        const activeDefinition = group.tools.find((tool) => tool.type === activeTool)
        const GroupIcon = activeDefinition?.icon ?? Shapes

        return (
          <DropdownMenu key={group.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost-icon"
                    className={cn(
                      'mx-1 justify-start',
                      !showLabels && 'justify-center px-0',
                      groupIsActive && 'bg-primary/15 text-primary',
                    )}
                  >
                    <GroupIcon size={14} />
                    {showLabels && <span className="truncate text-xs">{group.label}</span>}
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{activeDefinition?.label ?? group.label}</TooltipContent>
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

      {hasSelected && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost-icon"
              className={cn(
                'mx-1 justify-start text-red-400 hover:text-red-300',
                !showLabels && 'justify-center px-0',
              )}
              onClick={onDeleteSelected}
            >
              <Trash2 size={14} />
              {showLabels && <span className="truncate text-xs">Delete</span>}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete selected</TooltipContent>
        </Tooltip>
      )}

      <div
        className="absolute right-0 top-0 flex h-full w-2 translate-x-1 cursor-col-resize items-center justify-center text-muted-foreground/60 hover:text-primary"
        onPointerDown={handleResizePointerDown}
        aria-hidden="true"
      >
        <GripVertical size={12} />
      </div>
    </div>
  )
}
