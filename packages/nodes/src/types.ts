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
    context: {
      systemPrompt?: string
      messages: {
        id?: string
        role: 'user' | 'assistant'
        content: string
        createdAt?: Date | string | number
      }[]
    }
    options?: Record<string, unknown>
  }): Promise<AsyncIterable<{ type: string; [key: string]: unknown }>>
  parseJsonWithTolerance(text: string): unknown
}

export interface ExecuteContext {
  dataSourceService: DataSourceService
  llmService?: LlmService
  workflowInput?: Record<string, unknown>
  userId: string
  workflowId: string
  executionId: string
  nodeId: string
  upstreamOutputs: Record<string, Record<string, unknown>>
  log: (level: LogLevel, message: string) => void
}

export interface NodeMeta {
  type: string
  category: 'trigger' | 'source' | 'compute' | 'llm' | 'control' | 'output' | 'agent'
  label: string
  icon: string
  description: string
  color: string
}

export type FieldUIType = 'text' | 'number' | 'select' | 'code' | 'toggle' | 'branches' | 'schedule'

export interface BranchCondition {
  id: string
  type: 'if' | 'else-if' | 'else'
  condition?: string
}

export type ScheduleConfig =
  | {
      mode: 'interval'
      every: number
      unit: 'minute' | 'hour' | 'day'
      timezone: string
    }
  | {
      mode: 'daily'
      time: string
      timezone: string
    }
  | {
      mode: 'weekly'
      weekdays: number[]
      time: string
      timezone: string
    }
  | {
      mode: 'monthly'
      days: number[]
      time: string
      timezone: string
    }
  | {
      mode: 'cron'
      cron: string
      timezone: string
    }

export type OptionsSource =
  | { source: 'dataSourceInstances' }
  | { source: 'instanceSymbols' }
  | { source: 'instanceIntervals' }
  | { source: 'providers' }
  | { source: 'agents' }
  | { source: 'providerModels'; providerIdField: string }

export type AcceptableType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'file'

export interface OutputDef {
  name: string
  type: AcceptableType
  source: { field: string; path?: string }
  description?: string
}

export interface CustomOutputDef {
  name: string
  type: AcceptableType
  description?: string
  expression: string
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
  connection?: {
    target?: boolean
    source?: boolean
  }
}

export interface NodeCanvasViewRow {
  field?: string
  label: string
  value: string | number
  source?: boolean
  target?: boolean
}

export interface NodeCanvasView {
  icon: string
  title: string
  color?: string
  rows: NodeCanvasViewRow[]
}

export interface NodeCanvasViewInput {
  id: string
  data: Record<string, unknown>
  selected: boolean
  status?: 'idle' | 'running' | 'completed' | 'failed'
}

export type NodeCanvasViewFactory = (input: NodeCanvasViewInput) => NodeCanvasView

export interface NodeRegistryEntry {
  def: NodeDef
  execute: (input: Record<string, unknown>, ctx: ExecuteContext) => Promise<Record<string, unknown>>
  getCanvasView?: NodeCanvasViewFactory
}

export interface WebNodeRegistryEntry {
  def: NodeDef
  getCanvasView?: NodeCanvasViewFactory
}
