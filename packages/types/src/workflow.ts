export type NodeType =
  | 'source.price'
  | 'source.kline'
  | 'source.news'
  | 'compute.indicator'
  | 'compute.factor'
  | 'compute.python'
  | 'llm.signal'
  | 'llm.report'
  | 'llm.free'
  | 'control.branch'
  | 'control.parallel'
  | 'control.cron'
  | 'output.chart'
  | 'agent.call'

export type NodeCategory = 'source' | 'compute' | 'llm' | 'control' | 'output' | 'agent'

export interface WorkflowNode {
  id: string
  type: NodeType
  position: { x: number; y: number }
  data: Record<string, unknown>
}

export interface WorkflowEdge {
  id: string
  source: string
  sourceHandle: string
  target: string
  targetHandle: string
}

export interface WorkflowDefinition {
  id: string
  name: string
  description?: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  viewport?: { x: number; y: number; zoom: number }
  createdAt: string
  updatedAt: string
}
