import type { WorkflowEditOp } from '@eous/api-client'

function workflowContentOps(ops: WorkflowEditOp[]): WorkflowEditOp[] {
  return ops.filter((op) => op.type !== 'workflow.rename')
}

function createHistoryId(): string {
  return `history-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export { createHistoryId, workflowContentOps }
