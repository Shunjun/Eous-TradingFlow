export interface WorkflowRecord {
  id: string
  name: string
  description: string | null
  definition: string
  currentSeq?: number
  createdAt: Date
  updatedAt: Date
}

export interface WorkflowNodeExecutionRecord {
  id: string
  workflowId: string
  userId: string
  nodeId: string
  nodeType: string
  status: string
  inputs: string
  outputs: string | null
  error: string | null
  logs: string
  definitionHash: string
  durationMs: number | null
  startedAt: Date
  finishedAt: Date | null
}

export interface WorkflowCapabilityNode {
  id: string
  type: string
  data: Record<string, unknown>
  position?: { x: number; y: number }
  meta?: {
    locked?: boolean
    createdBy?: 'user' | 'agent'
    updatedBy?: string
  }
}

export interface WorkflowCapabilityEdge {
  id: string
  source: string
  sourceHandle?: string
  target: string
  targetHandle?: string
}

export interface WorkflowCapability {
  list(params: { userId: string; query?: string; limit?: number }): Promise<WorkflowRecord[]>
  get(params: { userId: string; workflowId: string }): Promise<WorkflowRecord>
  applyOps(params: {
    userId: string
    workflowId: string
    baseUpdatedAt?: string
    ops: unknown[]
  }): Promise<{ workflow: WorkflowRecord; appliedOps: number; warnings: string[] }>
  run(params: {
    userId: string
    workflowId: string
    input?: Record<string, unknown>
  }): Promise<unknown>
  runNode(params: {
    userId: string
    workflowId: string
    nodeId: string
    input?: Record<string, unknown>
  }): Promise<WorkflowNodeExecutionRecord>
  getVariables(params: { workflowId: string }): Promise<Record<string, Record<string, unknown>>>
  getExecutions(params: {
    workflowId: string
    limit?: number
  }): Promise<WorkflowNodeExecutionRecord[]>
}
