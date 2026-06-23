import type { Edge, Node } from '@xyflow/react'
import type { WorkflowEditOp } from '@eous/api-client'

interface LocalWorkflowDraft {
  nodes: Node[]
  edges: Edge[]
  name: string
  pendingOps?: WorkflowEditOp[]
  lastModified: number
}

function workflowDraftKey(id: string): string {
  return `eous-wf-${id}`
}

function isLocalWorkflowDraft(value: unknown): value is LocalWorkflowDraft {
  if (typeof value !== 'object' || value === null) return false
  return (
    'nodes' in value &&
    Array.isArray(value.nodes) &&
    'edges' in value &&
    Array.isArray(value.edges) &&
    'name' in value &&
    typeof value.name === 'string' &&
    'lastModified' in value &&
    typeof value.lastModified === 'number'
  )
}

function readWorkflowDraft(id: string): LocalWorkflowDraft | null {
  try {
    const raw = localStorage.getItem(workflowDraftKey(id))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isLocalWorkflowDraft(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeWorkflowDraft(id: string, draft: LocalWorkflowDraft): void {
  try {
    localStorage.setItem(workflowDraftKey(id), JSON.stringify(draft))
  } catch {
    // quota exceeded, ignore local recovery cache failure
  }
}

function removeWorkflowDraft(id: string): void {
  try {
    localStorage.removeItem(workflowDraftKey(id))
  } catch {
    // ignore local recovery cache failure
  }
}

export { readWorkflowDraft, removeWorkflowDraft, writeWorkflowDraft }
export type { LocalWorkflowDraft }
