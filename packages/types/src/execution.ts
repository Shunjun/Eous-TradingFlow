export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type ExecutionTrigger = 'manual' | 'cron' | 'event'

export interface NodeResult {
  nodeId: string
  status: ExecutionStatus
  inputData?: unknown
  outputData?: unknown
  error?: string
  startedAt?: string
  finishedAt?: string
}

export interface ExecutionRecord {
  id: string
  workflowId: string
  status: ExecutionStatus
  triggeredBy: ExecutionTrigger
  nodeResults: Record<string, NodeResult>
  startedAt?: string
  finishedAt?: string
  error?: string
}
