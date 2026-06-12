import type { AssetRef } from './asset.js'
import type { ExecutionRecord } from './execution.js'
import type { NewsArticle, OHLCVBar, Quote } from './provider.js'
import type { WorkflowDefinition } from './workflow.js'

/* ── Shared sub-types ─────────────────────────────────── */

export interface UserProfile {
  id: string
  email: string
  name: string
}

export interface Provider {
  id: string
  name: string
  kind: string
  baseUrl: string
  isActive: boolean
  createdAt: string
}

export interface ProviderModel {
  id: string
  modelId: string
  displayName: string | null
  maxTokens: number | null
  capabilities: string[]
  enabled: boolean
}

export interface ProviderTemplate {
  kind: string
  label: string
  defaultBaseUrl: string
  hint?: string
}

export interface TestResult {
  ok?: boolean
  modelCount?: number
  error?: string
}

export interface ConfigFieldSchema {
  key: string
  label: string
  type: 'text' | 'password' | 'select' | 'number' | 'boolean'
  required?: boolean
  placeholder?: string
  hint?: string
  options?: { label: string; value: string }[]
  optionsSource?: { source: 'provider' }
  defaultValue?: string | number | boolean
}

export interface ConfigFieldOption {
  label: string
  value: string
}

export interface DataSourceProvider {
  id: string
  name: string
  configSchema: ConfigFieldSchema[]
}

export interface DataSourceInstance {
  id: string
  name: string
  providerKind: string
  defaultSymbol: string
  identityKey?: string
  identityLabel?: string | null
  createdAt?: string
}

export interface DataSourceDetail extends DataSourceInstance {
  trackedSymbols: TrackedSymbol[]
}

export interface TrackedSymbol {
  id: string
  symbol: string
  name: string | null
  exchange: string | null
  type: string | null
}

export interface SymbolSearchResult {
  symbol: string
  name: string
  exchange?: string
  type?: string
}

export interface WorkspaceLayoutSummary {
  id: string
  name: string
  updatedAt: string
}

export interface AgentSummary {
  id: string
  name: string
  description: string | null
  systemPrompt: string | null
  providerId: string | null
  modelId: string | null
  createdAt: string
  updatedAt: string
}

export interface AgentSessionSummary {
  id: string
  agentId: string
  title: string
  summary: string | null
  workflowId: string | null
  createdAt: string
  updatedAt: string
}

export interface AgentMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  metadata: Record<string, unknown>
  createdAt: string
}

export interface AgentMemory {
  id: string
  scope: string
  targetId: string
  kind: string
  content: string
  tags: string[]
  importance: number
  confidence: number
  createdAt: string
  updatedAt: string
}

/* ── API Client Interface ─────────────────────────────── */

export interface ApiClient {
  // ── Data APIs ──
  getQuote(symbol: string): Promise<Quote>
  getKlines(params: {
    symbol: string
    interval: string
    from?: number
    to?: number
    limit?: number
  }): Promise<OHLCVBar[]>
  searchNews(params: { query: string; language?: string; limit?: number }): Promise<NewsArticle[]>

  // ── Workflow APIs ──
  listWorkflows(): Promise<WorkflowDefinition[]>
  getWorkflow(id: string): Promise<WorkflowDefinition>
  createWorkflow(params: {
    name: string
    definition: string
  }): Promise<{ workflow: WorkflowDefinition }>
  saveWorkflow(workflow: WorkflowDefinition): Promise<void>
  deleteWorkflow(id: string): Promise<void>

  // ── Execution APIs ──
  executeWorkflow(id: string): Promise<ExecutionRecord>
  cancelExecution(id: string): Promise<void>
  getExecution(id: string): Promise<ExecutionRecord>

  // ── Node Execution APIs ──
  runWorkflowNode(
    workflowId: string,
    nodeId: string,
  ): Promise<{
    execution: {
      id: string
      nodeId: string
      status: string
      inputs: Record<string, unknown> | null
      outputs: Record<string, unknown> | null
      logs: Array<{ ts: string; level: string; message: string }>
      durationMs: number | null
      error: string | null
    } | null
  }>
  getNodeLastExecution(
    workflowId: string,
    nodeId: string,
  ): Promise<{
    execution: {
      id: string
      nodeId: string
      status: string
      inputs: Record<string, unknown> | null
      outputs: Record<string, unknown> | null
      logs: Array<{ ts: string; level: string; message: string }>
      durationMs: number | null
      error: string | null
    } | null
  }>
  getWorkflowVariables(workflowId: string): Promise<{
    variables: Record<string, Record<string, unknown>>
  }>
  getWorkflowExecutions(
    workflowId: string,
    limit?: number,
  ): Promise<{
    executions: Array<{
      id: string
      nodeId: string
      nodeType: string
      status: string
      inputs: Record<string, unknown> | null
      outputs: Record<string, unknown> | null
      logs: Array<{ ts: string; level: string; message: string }>
      durationMs: number | null
      error: string | null
      startedAt: string
      finishedAt: string | null
    }>
  }>

  // ── Asset APIs ──
  getWatchedAssets(): Promise<AssetRef[]>
  addAsset(asset: AssetRef): Promise<void>
  removeAsset(id: string): Promise<void>

  // ── Auth APIs ──
  me(): Promise<UserProfile>
  login(params: { email: string; password: string }): Promise<void>
  logout(): Promise<void>

  // ── Provider APIs ──
  listProviders(): Promise<{ providers: Provider[] }>
  getProvider(id: string): Promise<{ models: ProviderModel[] }>
  createProvider(params: {
    name: string
    kind: string
    baseUrl: string
    apiKey: string
  }): Promise<{ provider: Provider }>
  deleteProvider(id: string): Promise<void>
  testProvider(id: string): Promise<TestResult>
  syncProvider(id: string): Promise<void>
  listProviderTemplates(): Promise<{ templates: ProviderTemplate[] }>
  addProviderModel(
    providerId: string,
    params: {
      modelId: string
      displayName?: string
      maxTokens?: number
      capabilities?: string[]
    },
  ): Promise<void>
  updateProviderModel(
    providerId: string,
    modelId: string,
    params: {
      enabled?: boolean
      displayName?: string | null
      maxTokens?: number | null
      capabilities?: string[]
    },
  ): Promise<void>
  deleteProviderModel(providerId: string, modelId: string): Promise<void>

  // ── Data Source APIs ──
  listDataSourceProviders(): Promise<{ providers: DataSourceProvider[] }>
  getDataSourceProviderOptions(
    providerId: string,
    fieldKey: string,
    query?: string,
  ): Promise<{ options: ConfigFieldOption[] }>
  listDataSourceInstances(): Promise<{ instances: DataSourceInstance[] }>
  getDataSourceInstance(id: string): Promise<{ instance: DataSourceDetail }>
  createDataSourceInstance(params: {
    name: string
    providerKind: string
    defaultSymbol: string
    config: Record<string, unknown>
  }): Promise<void>
  deleteDataSourceInstance(id: string): Promise<void>
  testDataSourceInstance(id: string): Promise<{ ok: boolean; error?: string }>
  getDataSourceInstanceSymbols(
    instanceId: string,
    query: string | undefined,
  ): Promise<{ symbols: SymbolSearchResult[]; total: number }>
  getDataSourceInstanceIntervals(
    instanceId: string,
  ): Promise<{ intervals: { value: string; label: string }[] }>
  addDataSourceSymbol(
    instanceId: string,
    params: {
      symbol: string
      name: string
      exchange?: string
      type?: string
    },
  ): Promise<void>
  getDataSourceKlines(
    instanceId: string,
    params: {
      symbol: string
      interval: string
      from?: number
      to?: number
    },
  ): Promise<{ klines: unknown[] }>

  // ── Workspace APIs ──
  listWorkspaceLayouts(): Promise<{
    layouts: WorkspaceLayoutSummary[]
    activeLayoutId: string | null
  }>
  getWorkspaceLayout(
    id: string,
  ): Promise<{ layout: { id: string; name: string; schemaJson: unknown; updatedAt: string } }>
  createWorkspaceLayout(params: {
    name: string
    setActive?: boolean
    copyFromId?: string
  }): Promise<{ id: string; name: string }>
  saveWorkspaceLayout(id: string, params: { schemaJson: unknown; name?: string }): Promise<void>
  deleteWorkspaceLayout(id: string): Promise<{ newActiveLayoutId?: string }>
  activateWorkspaceLayout(id: string): Promise<{ activeLayoutId: string }>

  // ── Agent APIs ──
  listAgents(): Promise<{ agents: AgentSummary[] }>
  createAgent(params: {
    name: string
    description?: string | null
    systemPrompt?: string | null
    providerId?: string | null
    modelId?: string | null
  }): Promise<{ agent: AgentSummary }>
  updateAgent(
    id: string,
    params: {
      name?: string
      description?: string | null
      systemPrompt?: string | null
      providerId?: string | null
      modelId?: string | null
    },
  ): Promise<{ agent: AgentSummary }>
  listAgentSessions(): Promise<{ sessions: AgentSessionSummary[] }>
  createAgentSession(params: {
    agentId?: string
    title?: string
    workflowId?: string
  }): Promise<{ session: AgentSessionSummary }>
  getAgentSession(id: string): Promise<{
    session: AgentSessionSummary
    messages: AgentMessage[]
  }>
  listAgentMemories(params?: {
    agentId?: string
    sessionId?: string
    query?: string
  }): Promise<{ memories: AgentMemory[] }>
  createAgentMemory(params: {
    agentId?: string
    sessionId?: string
    scope: string
    targetId?: string
    kind: string
    content: string
    tags?: string[]
    importance?: number
    confidence?: number
  }): Promise<{ memory: AgentMemory }>
}
