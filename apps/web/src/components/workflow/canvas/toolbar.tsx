import { cloneElement, isValidElement, useCallback } from 'react'
import { Hand, LayoutGrid, MousePointer2, Plus, Scan } from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import {
  Button,
  Separator,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@eous/ui'
import { NodeSelector } from '../nodes'
import { WORKFLOW_FIT_VIEW_OPTIONS } from './viewport'
import { useWorkflowStore, useWorkflowStoreApi } from '../store/workflow-store'
import { useWorkflowNodeActions } from '../hooks'
import { getFlowViewportCenterPosition } from './flow-position'
import { validateCanAddNodeType } from '../utils'

export type CanvasInteractionMode = 'pan' | 'select'

type ToolbarTooltipProps = React.HTMLAttributes<HTMLElement> & {
  label: string
  children: React.ReactElement
  preserveChildState?: boolean
}

function ToolbarTooltip({
  label,
  children,
  preserveChildState = false,
  ...triggerProps
}: ToolbarTooltipProps) {
  const trigger = isValidElement(children)
    ? cloneElement(children, triggerProps as React.HTMLAttributes<HTMLElement>)
    : children

  return (
    <Tooltip delayDuration={1000}>
      {preserveChildState ? (
        <TooltipTrigger asChild>
          <span className="inline-flex">{children}</span>
        </TooltipTrigger>
      ) : (
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      )}
      <TooltipContent side="right" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function Toolbar() {
  const { fitView, screenToFlowPosition } = useReactFlow()
  const workflowStore = useWorkflowStoreApi()
  const mode = useWorkflowStore((state) => state.canvasMode)
  const setCanvasMode = useWorkflowStore((state) => state.setCanvasMode)
  const addDefaultNode = useWorkflowStore((state) => state.addDefaultNode)
  const commitOps = useWorkflowStore((state) => state.commitOps)
  const { autoLayout } = useWorkflowNodeActions({ workflowStore, commitOps, fitView })

  const handleFitView = useCallback(() => {
    void fitView({ ...WORKFLOW_FIT_VIEW_OPTIONS, duration: 240 })
  }, [fitView])

  const handleAddNode = useCallback(
    (nodeType: string) => {
      if (!validateCanAddNodeType(nodeType, workflowStore.getState().nodes)) return
      addDefaultNode(nodeType, getFlowViewportCenterPosition(screenToFlowPosition))
    },
    [addDefaultNode, screenToFlowPosition, workflowStore],
  )

  return (
    <div className="pointer-events-auto flex w-10 flex-col items-center gap-1 rounded-lg border border-border bg-card/90 py-1.5 shadow-sm backdrop-blur">
      <NodeSelector onSelectNode={handleAddNode}>
        <ToolbarTooltip label="添加节点">
          <Button size="sm" variant="default" className="h-7 w-7">
            <Plus className="h-4 w-4" />
          </Button>
        </ToolbarTooltip>
      </NodeSelector>

      <Separator className="w-5" />

      <ToggleGroup
        type="single"
        orientation="vertical"
        spacing={1}
        value={mode}
        onValueChange={(value) => {
          if (value === 'pan' || value === 'select') setCanvasMode(value)
        }}
      >
        <ToolbarTooltip label="框选" preserveChildState>
          <ToggleGroupItem value="select" aria-label="框选" className="h-7 w-7">
            <MousePointer2 className="h-4 w-4" />
          </ToggleGroupItem>
        </ToolbarTooltip>
        <ToolbarTooltip label="拖拽画布" preserveChildState>
          <ToggleGroupItem value="pan" aria-label="拖拽画布" className="h-7 w-7">
            <Hand className="h-4 w-4" />
          </ToggleGroupItem>
        </ToolbarTooltip>
      </ToggleGroup>

      <Separator className="w-5" />

      <ToolbarTooltip label="自动布局">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7"
          onClick={autoLayout}
          aria-label="自动布局"
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
      </ToolbarTooltip>

      <ToolbarTooltip label="画布自适应">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7"
          onClick={handleFitView}
          aria-label="画布自适应"
        >
          <Scan className="h-4 w-4" />
        </Button>
      </ToolbarTooltip>
    </div>
  )
}

Toolbar.displayName = 'Toolbar'

export { Toolbar }
