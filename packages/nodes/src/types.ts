export type TypeRef = 'string' | 'number' | 'boolean' | 'OHLCVBar' | 'OHLCVBar[]' | string

export interface OutputExpr {
  field: string
  path?: string
}

export interface OutputField {
  name: string
  type: TypeRef
  source: OutputExpr
  description?: string
}

export interface ExecuteContext {
  dataSource: unknown
  userId: string
  workflowId: string
  executionId: string
}

export interface NodeMeta {
  type: string
  category: 'source' | 'compute' | 'llm' | 'control' | 'output' | 'agent'
  label: string
  icon: string
  description: string
}

export interface ParamDef {
  type: TypeRef
  from: 'panel'
  required?: boolean
  default?: unknown
  description?: string
}

export interface NodeComponentProps {
  id: string
  data: Record<string, unknown>
  selected: boolean
  status?: 'idle' | 'running' | 'completed' | 'failed'
  onChange?: (data: Record<string, unknown>) => void
}
