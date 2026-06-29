import { useEffect, useMemo } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Button } from '@eous/ui'
import { useWorkflowList } from '../../../hooks/use-workflows.js'
import { WorkflowEditor } from '../../workflow/workflow-editor.js'
import { PageLoading } from '../../PageLoading.js'
import type { WorkflowViewProps } from './use-workflow-view-state.js'

export function WorkflowView({ workflowId, onWorkflowSelect }: WorkflowViewProps) {
  const { workflows, loading } = useWorkflowList()

  const activeWorkflow = useMemo(
    () => workflows.find((workflow) => workflow.id === workflowId) ?? null,
    [workflowId, workflows],
  )

  useEffect(() => {
    if (workflowId || workflows.length === 0) return
    onWorkflowSelect(workflows[0].id)
  }, [workflowId, workflows, onWorkflowSelect])

  if (loading && !workflowId) {
    return <PageLoading label="Loading workflows..." />
  }

  if (!workflowId) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <div className="text-sm font-medium text-foreground">没有可用工作流</div>
          <div className="text-xs text-muted-foreground">请先在侧边栏创建一个工作流。</div>
        </div>
      </div>
    )
  }

  if (!loading && workflows.length > 0 && !activeWorkflow) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <div className="text-sm font-medium text-foreground">工作流不存在或已被删除</div>
          <Button size="sm" variant="outline" onClick={() => onWorkflowSelect(workflows[0].id)}>
            打开第一个工作流
          </Button>
        </div>
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <WorkflowEditor
        workflowId={workflowId}
        showWorkflowList
        onWorkflowSelect={onWorkflowSelect}
      />
    </ReactFlowProvider>
  )
}
