import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@eous/ui'
import type { WorkflowDefinition, WorkflowEditOp } from '@eous/api-client'
import type { Edge, Node } from '@xyflow/react'

type WorkflowSaveConflictState = null | {
  latestWorkflow: WorkflowDefinition
  pendingOps: WorkflowEditOp[]
  canMerge: boolean
  reason?: string
  rebased?: {
    nodes: Node[]
    edges: Edge[]
    workflowName: string
  }
}

interface WorkflowSaveConflictDialogProps {
  conflict: WorkflowSaveConflictState
  resolving: boolean
  onOpenChange: (open: boolean) => void
  onMerge: () => void
  onSaveAsCopy: () => void
  onDiscard: () => void
}

function WorkflowSaveConflictDialog({
  conflict,
  resolving,
  onOpenChange,
  onMerge,
  onSaveAsCopy,
  onDiscard,
}: WorkflowSaveConflictDialogProps) {
  return (
    <Dialog open={conflict !== null} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={!resolving}>
        <DialogHeader>
          <DialogTitle>{conflict?.canMerge ? '工作流已更新' : '无法自动合并'}</DialogTitle>
          <DialogDescription>
            {conflict?.canMerge
              ? '服务端版本已被修改。可以尝试把你的本地修改合并到最新版本，或保存为新的副本。'
              : `服务端版本已被修改，当前本地修改无法自动合并${
                  conflict?.reason ? `：${conflict.reason}` : ''
                }。可以保存为新的副本，或丢弃本地修改并加载服务端版本。`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {conflict?.canMerge ? (
            <>
              <Button type="button" variant="outline" disabled={resolving} onClick={onSaveAsCopy}>
                保存为副本
              </Button>
              <Button type="button" disabled={resolving} onClick={onMerge}>
                合并修改
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="destructive" disabled={resolving} onClick={onDiscard}>
                丢弃本地修改
              </Button>
              <Button type="button" disabled={resolving} onClick={onSaveAsCopy}>
                保存为副本
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { WorkflowSaveConflictDialog }
export type { WorkflowSaveConflictState }
