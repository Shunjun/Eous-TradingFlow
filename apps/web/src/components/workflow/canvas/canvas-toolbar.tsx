import { useCallback } from 'react'
import { Hand, MousePointer2, Plus, Scan } from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import { Button, Separator, ToggleGroup, ToggleGroupItem } from '@eous/ui'
import { NodeSelector } from '../nodes'
import { WORKFLOW_FIT_VIEW_OPTIONS } from './viewport'
import { useWorkflowStore } from '../store/workflow-store'

export type CanvasInteractionMode = 'pan' | 'select'

function CanvasToolbar() {
  const { fitView } = useReactFlow()
  const mode = useWorkflowStore((state) => state.canvasMode)
  const setCanvasMode = useWorkflowStore((state) => state.setCanvasMode)
  const addDefaultNode = useWorkflowStore((state) => state.addDefaultNode)

  const handleFitView = useCallback(() => {
    void fitView({ ...WORKFLOW_FIT_VIEW_OPTIONS, duration: 240 })
  }, [fitView])

  return (
    <div className="pointer-events-auto flex w-10 flex-col items-center gap-1 rounded-lg border border-border bg-card/90 py-1.5 shadow-sm backdrop-blur">
      <NodeSelector onSelectNode={addDefaultNode}>
        <Button size="sm" variant="default" className="h-7 w-7">
          <Plus className="h-4 w-4" />
        </Button>
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
        <ToggleGroupItem value="select" aria-label="框选" className="h-7 w-7">
          <MousePointer2 className="h-4 w-4" />
        </ToggleGroupItem>
        <ToggleGroupItem value="pan" aria-label="拖拽画布" className="h-7 w-7">
          <Hand className="h-4 w-4" />
        </ToggleGroupItem>
      </ToggleGroup>

      <Separator className="w-5" />

      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7"
        onClick={handleFitView}
        aria-label="画布自适应"
      >
        <Scan className="h-4 w-4" />
      </Button>
    </div>
  )
}

CanvasToolbar.displayName = 'CanvasToolbar'

export { CanvasToolbar }
