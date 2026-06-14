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

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  ts: string
  level: LogLevel
  message: string
}

export interface DataSourceInstanceConfig {
  providerKind: string
  config: Record<string, string>
}

export interface DataSourceService {
  getInstanceConfig(userId: string, instanceId: string): Promise<DataSourceInstanceConfig>
}

export interface LlmService {
  streamChat(options: {
    providerId: string
    modelId: string
    memory?: {
      enabled?: boolean
      agentId?: string
      query?: string
      limit?: number
    }
    context: {
      systemPrompt?: string
      messages: { role: 'user' | 'assistant'; content: string; timestamp: number }[]
    }
    options?: Record<string, unknown>
  }): Promise<AsyncIterable<{ type: string; [key: string]: unknown }>>
  parseJsonWithTolerance(text: string): unknown
}

export interface ExecuteContext {
  dataSourceService: DataSourceService
  llmService?: LlmService
  userId: string
  workflowId: string
  executionId: string
  nodeId: string
  upstreamOutputs: Record<string, Record<string, unknown>>
  log: (level: LogLevel, message: string) => void
}

export interface NodeMeta {
  type: string
  category: 'source' | 'compute' | 'llm' | 'control' | 'output' | 'agent'
  label: string
  icon: string
  description: string
  color: string
}

export type FieldUIType = 'text' | 'number' | 'select' | 'code' | 'toggle'

export type OptionsSource =
  | { source: 'dataSourceInstances' }
  | { source: 'instanceSymbols' }
  | { source: 'instanceIntervals' }
  | { source: 'providers' }
  | { source: 'agents' }
  | { source: 'providerModels'; providerIdField: string }

export type AcceptableType = 'string' | 'number' | 'boolean' | 'json' | 'array' | 'file'

/** User-configured output definition — single source of truth for node outputs */
export interface OutputDef {
  name: string
  type: AcceptableType
  source: { field: string; path?: string }
}

export interface ParamDef {
  type: TypeRef
  from: 'panel'
  required?: boolean
  default?: unknown
  description?: string
  /** UI rendering hint — 'text' is the default when omitted */
  ui?: FieldUIType
  /** Display label for the config panel (falls back to description) */
  label?: string
  placeholder?: string
  /** Dynamic options source — replaces static options */
  optionsSource?: OptionsSource
  /** Which variable types are acceptable for this field (undefined = all) */
  acceptTypes?: AcceptableType[]
}

export interface NodeDef {
  meta: NodeMeta
  executeInput: Record<string, ParamDef>
  executeOutput: Record<string, OutputField>
}

export interface NodeComponentProps {
  id: string
  data: Record<string, unknown>
  selected: boolean
  status?: 'idle' | 'running' | 'completed' | 'failed'
  onChange?: (data: Record<string, unknown>) => void
}

export interface NodeRegistryEntry {
  def: NodeDef
  canvas: (props: NodeComponentProps) => unknown
  execute: (input: Record<string, unknown>, ctx: ExecuteContext) => Promise<Record<string, unknown>>
}

export interface WebNodeRegistryEntry {
  def: NodeDef
  canvas: (props: NodeComponentProps) => unknown
}
