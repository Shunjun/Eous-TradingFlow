/* ── Shared DTOs ─────────────────────────────────────── */

export { createMarketDataSocketClient } from './market-data.js'
export type {
  KlineDataPoint,
  MarketDataSocketClient,
  MarketDataSocketOptions,
  MarketDataSubscribeParams,
  RealtimeMode,
  RealtimeSubscribeMode,
} from './market-data.js'

export type AssetType = 'stock' | 'crypto' | 'forex' | 'etf' | 'index'

export interface AssetRef {
  symbol: string
  type: AssetType
  exchange?: string
  name?: string
}

export interface OHLCVBar {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface Quote {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  high: number
  low: number
  timestamp: number
}

export interface NewsArticle {
  id: string
  title: string
  summary: string
  content?: string
  url: string
  source: string
  publishedAt: string
  language: string
  relatedSymbols?: string[]
}

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
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

export type NodeType = string
export type NodeCategory = 'trigger' | 'source' | 'compute' | 'llm' | 'control' | 'output' | 'agent'

export interface ExecuteWorkflowRequest {
  input?: {
    userInput?: string
    [key: string]: unknown
  }
}

export interface WorkflowNode {
  id: string
  type: NodeType
  position: { x: number; y: number }
  data: Record<string, unknown>
  meta?: {
    locked?: boolean
    createdBy?: 'user' | 'agent'
    updatedBy?: string
  }
}

export interface WorkflowEdge {
  id: string
  source: string
  sourceHandle?: string
  target: string
  targetHandle?: string
}

export interface WorkflowDefinitionDocument {
  schemaVersion: 1
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  viewport?: { x: number; y: number; zoom: number }
}

export type WorkflowEditOp =
  | { type: 'workflow.rename'; name: string; description?: string }
  | { type: 'node.add'; node: WorkflowNode }
  | {
      type: 'node.update'
      nodeId: string
      dataPatch?: Record<string, unknown>
      position?: { x: number; y: number }
      metaPatch?: WorkflowNode['meta']
      force?: boolean
    }
  | { type: 'node.delete'; nodeId: string; force?: boolean }
  | { type: 'edge.add'; edge: WorkflowEdge }
  | { type: 'edge.update'; edgeId: string; patch: Partial<WorkflowEdge> }
  | { type: 'edge.delete'; edgeId: string }
  | {
      type: 'node.insertBetween'
      edgeId: string
      node: WorkflowNode
      sourceToNewEdge?: Partial<WorkflowEdge>
      newToTargetEdge?: Partial<WorkflowEdge>
    }

export interface ApplyWorkflowOpsRequest {
  baseUpdatedAt?: string
  ops: WorkflowEditOp[]
}

export interface ApplyWorkflowOpsResponse {
  workflow: WorkflowDefinition
  appliedOps: number
  warnings: string[]
}

export interface WorkflowEditEvent {
  id: string
  workflowId: string
  seq: number
  kind: string
  label: string | null
  ops: WorkflowEditOp[]
  inverseOps: WorkflowEditOp[]
  snapshotName: string | null
  targetVersionId: string | null
  targetSeq: number | null
  createdAt: string
}

export interface ApplyWorkflowEventRequest {
  baseSeq: number
  ops: WorkflowEditOp[]
  label?: string
  clientBatchId?: string
}

export interface ApplyWorkflowEventResponse {
  workflow: WorkflowDefinition
  event: WorkflowEditEvent
  warnings: string[]
}

export interface WorkflowDefinition {
  id: string
  name: string
  description?: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  viewport?: { x: number; y: number; zoom: number }
  currentSeq: number
  enabled: boolean
  activeVersionId: string | null
  createdAt: string
  updatedAt: string
}

export interface WorkflowVersion {
  id: string
  workflowId: string
  version: number
  definition: string
  note: string | null
  createdAt: string
  createdBy: string
}

export interface WorkflowRunNodeExecution {
  id: string
  runId?: string
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
}

export interface WorkflowRun {
  id: string
  workflowId: string
  workflowVersionId: string | null
  workflowVersion?: WorkflowVersion | null
  userId: string
  trigger: string
  source: string
  status: string
  definition: string
  report: string | null
  error: string | null
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  createdAt: string
}

export interface WorkflowRunDetail extends WorkflowRun {
  nodeExecutions: WorkflowRunNodeExecution[]
}

export interface UserProfile {
  id: string
  email: string
  name: string
}

export interface Provider {
  id: string
  name: string
  kind: string
  apiFormat: string
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

export interface ModelRef {
  providerId: string
  modelId: string
}

export interface UserModelSettings {
  chat: ModelRef | null
  compression: ModelRef | null
  embedding: ModelRef | null
}

export interface KnowledgeBase {
  id: string
  name: string
  description: string | null
  enabled: boolean
  metadata: Record<string, unknown>
  activeIndexId: string | null
  createdAt: string
  updatedAt: string
}

export interface KnowledgeDocument {
  id: string
  knowledgeBaseId: string
  title: string
  sourceType: string
  sourceUri: string | null
  sourceFileName: string | null
  sourceMimeType: string | null
  sourceSize: number | null
  sourceHash: string | null
  strategy: string
  status: string
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface ProviderRemoteModel {
  modelId: string
  displayName?: string
  maxTokens?: number
  capabilities: string[]
}

export interface ProviderTemplate {
  kind: string
  label: string
  defaultBaseUrl: string
  defaultApiFormat: string
  apiFormats: { value: string; label: string }[]
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
  instructions: string | null
  providerId: string | null
  modelId: string | null
  toolScope: string[]
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

export interface ChartDrawingPayload {
  symbol: string
  payload: string
  updatedAt?: string | null
}

export type IntervalSupportMode = 'native' | 'derived'
export type IntervalAggregation = 'duration' | 'calendar'

export interface IntervalSupport {
  requestedInterval: string
  interval: string
  supported: boolean
  mode?: IntervalSupportMode
  baseInterval?: string
  aggregation?: IntervalAggregation
  reason?: string
}

export interface ChartIntervalSettings {
  visible: string[]
  custom: { value: string; label?: string }[]
}

export interface ChartConfig {
  autoSaveDrawings: boolean
  intervalSettings: ChartIntervalSettings
}

/* ── API Client Interface ─────────────────────────────── */

export interface ApiClient {
  getQuote(symbol: string): Promise<Quote>
  getKlines(params: {
    symbol: string
    interval: string
    from?: number
    to?: number
    limit?: number
  }): Promise<OHLCVBar[]>
  searchNews(params: { query: string; language?: string; limit?: number }): Promise<NewsArticle[]>

  listWorkflows(): Promise<WorkflowDefinition[]>
  getWorkflow(id: string): Promise<WorkflowDefinition>
  createWorkflow(params: {
    name: string
    definition: string
  }): Promise<{ workflow: WorkflowDefinition }>
  updateWorkflowMeta(
    id: string,
    params: { name?: string; description?: string },
  ): Promise<{ workflow: WorkflowDefinition }>
  saveWorkflow(workflow: WorkflowDefinition): Promise<void>
  applyWorkflowOps(
    workflowId: string,
    request: ApplyWorkflowOpsRequest,
  ): Promise<ApplyWorkflowOpsResponse>
  applyWorkflowEvent(
    workflowId: string,
    request: ApplyWorkflowEventRequest,
  ): Promise<ApplyWorkflowEventResponse>
  getWorkflowHistory(workflowId: string): Promise<{
    events: WorkflowEditEvent[]
    canUndo: boolean
    canRedo: boolean
  }>
  undoWorkflow(workflowId: string): Promise<ApplyWorkflowEventResponse>
  redoWorkflow(workflowId: string): Promise<ApplyWorkflowEventResponse>
  createWorkflowSnapshot(
    workflowId: string,
    request?: { name?: string },
  ): Promise<{ workflow: WorkflowDefinition; snapshot: WorkflowEditEvent }>
  listWorkflowSnapshots(workflowId: string): Promise<{ snapshots: WorkflowEditEvent[] }>
  restoreWorkflowSnapshot(
    workflowId: string,
    eventId: string,
  ): Promise<{ workflow: WorkflowDefinition; event: WorkflowEditEvent }>
  deleteWorkflow(id: string): Promise<void>
  setWorkflowEnabled(id: string, enabled: boolean): Promise<{ workflow: WorkflowDefinition }>
  publishWorkflow(id: string, params?: { note?: string }): Promise<{ version: WorkflowVersion }>
  listWorkflowVersions(workflowId: string): Promise<{ versions: WorkflowVersion[] }>
  setActiveWorkflowVersion(
    workflowId: string,
    versionId: string,
  ): Promise<{ workflow: WorkflowDefinition }>
  restoreWorkflowVersionToDraft(
    workflowId: string,
    versionId: string,
  ): Promise<{ workflow: WorkflowDefinition; event: WorkflowEditEvent }>

  executeWorkflow(id: string, request?: ExecuteWorkflowRequest): Promise<ExecutionRecord>
  cancelExecution(id: string): Promise<void>
  getExecution(id: string): Promise<ExecutionRecord>

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
    executions?: Array<{
      id: string
      nodeId: string
      status: string
      inputs: Record<string, unknown> | null
      outputs: Record<string, unknown> | null
      logs: Array<{ ts: string; level: string; message: string }>
      durationMs: number | null
      error: string | null
    }>
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
  getWorkflowRuns(workflowId: string, limit?: number): Promise<{ runs: WorkflowRun[] }>
  getWorkflowRun(workflowId: string, runId: string): Promise<{ run: WorkflowRunDetail }>

  getWatchedAssets(): Promise<AssetRef[]>
  addAsset(asset: AssetRef): Promise<void>
  removeAsset(id: string): Promise<void>

  me(): Promise<UserProfile>
  login(params: { email: string; password: string }): Promise<void>
  logout(): Promise<void>

  getModelSettings(): Promise<{ settings: UserModelSettings }>
  updateModelSettings(params: Partial<UserModelSettings>): Promise<{ settings: UserModelSettings }>

  listKnowledgeBases(): Promise<{ knowledgeBases: KnowledgeBase[] }>
  getKnowledgeBase(id: string): Promise<{ knowledgeBase: KnowledgeBase }>
  createKnowledgeBase(params: {
    name: string
    description?: string | null
    metadata?: Record<string, unknown>
  }): Promise<{ knowledgeBase: KnowledgeBase }>
  updateKnowledgeBase(
    id: string,
    params: {
      name?: string
      description?: string | null
      enabled?: boolean
      metadata?: Record<string, unknown>
      activeIndexId?: string | null
    },
  ): Promise<{ knowledgeBase: KnowledgeBase }>
  deleteKnowledgeBase(id: string): Promise<void>
  listKnowledgeDocuments(knowledgeBaseId: string): Promise<{ documents: KnowledgeDocument[] }>
  createKnowledgeDocument(
    knowledgeBaseId: string,
    params: {
      title: string
      sourceType?: string
      sourceUri?: string | null
      sourceFileName?: string | null
      sourceMimeType?: string | null
      sourceSize?: number | null
      sourceHash?: string | null
      strategy?: 'raw' | 'compressed' | 'hybrid'
      metadata?: Record<string, unknown>
    },
  ): Promise<{ document: KnowledgeDocument }>
  deleteKnowledgeDocument(documentId: string): Promise<void>

  listProviders(): Promise<{ providers: Provider[] }>
  getProvider(id: string): Promise<{ provider: Provider; models: ProviderModel[] }>
  createProvider(params: {
    name: string
    kind: string
    apiFormat?: string
    baseUrl: string
    apiKey: string
  }): Promise<{ provider: Provider }>
  updateProvider(
    id: string,
    params: {
      name?: string
      apiFormat?: string
      baseUrl?: string
      apiKey?: string
    },
  ): Promise<{ provider: Provider }>
  deleteProvider(id: string): Promise<void>
  testProvider(id: string): Promise<TestResult>
  syncProvider(id: string): Promise<{ models: ProviderRemoteModel[] }>
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
  getDataSourceInstanceIntervalSupport(
    instanceId: string,
    intervals: string[],
  ): Promise<{ intervals: IntervalSupport[] }>
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
      query?: 'latest' | 'before' | 'range'
      from?: number
      to?: number
      before?: number
      limit?: number
      mode?: 'closed-only' | 'include-live'
    },
  ): Promise<{ klines: unknown[] }>
  getDataSourceDrawings(
    instanceId: string,
    symbol: string,
  ): Promise<{ drawing: ChartDrawingPayload }>
  saveDataSourceDrawings(
    instanceId: string,
    params: { drawings: { symbol: string; payload: string }[] },
  ): Promise<{ saved: number }>
  getChartConfig(): Promise<{ config: ChartConfig }>
  updateChartConfig(params: Partial<ChartConfig>): Promise<{ config: ChartConfig }>

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

  listAgents(): Promise<{ agents: AgentSummary[] }>
  createAgent(params: {
    name: string
    description?: string | null
    instructions?: string | null
    providerId?: string | null
    modelId?: string | null
    toolScope?: string[]
  }): Promise<{ agent: AgentSummary }>
  updateAgent(
    id: string,
    params: {
      name?: string
      description?: string | null
      instructions?: string | null
      providerId?: string | null
      modelId?: string | null
      toolScope?: string[]
    },
  ): Promise<{ agent: AgentSummary }>
  deleteAgent(id: string): Promise<void>
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
  deleteAgentSession(id: string): Promise<void>
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

/* ── HTTP Client ─────────────────────────────────────── */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface RequestContext {
  method: string
  url: string
  headers: Record<string, string>
  body?: unknown
}

export interface ResponseContext {
  status: number
  ok: boolean
  json: <T>() => Promise<T>
  text: () => Promise<string>
}

export type RequestInterceptor = (ctx: RequestContext) => RequestContext | Promise<RequestContext>
export type ResponseInterceptor = (
  ctx: ResponseContext,
) => ResponseContext | Promise<ResponseContext>
export type ResponseErrorHandler = (error: ApiError, ctx: ResponseContext) => void | Promise<void>

export interface HttpClientOptions {
  baseURL?: string
  getToken?: () => string | null
  credentials?: RequestCredentials
  onUnauthorized?: () => void
  onError?: ResponseErrorHandler
  requestInterceptors?: RequestInterceptor[]
  responseInterceptors?: ResponseInterceptor[]
}

interface RawWorkflow {
  id: string
  name: string
  description?: string
  definition: string
  currentSeq?: number
  enabled?: boolean
  activeVersionId?: string | null
  createdAt: string
  updatedAt: string
}

function parseWorkflowDefinition(raw: string): {
  nodes: WorkflowDefinition['nodes']
  edges: WorkflowDefinition['edges']
} {
  try {
    const parsed = JSON.parse(raw) as { nodes?: unknown; edges?: unknown }
    return {
      nodes: Array.isArray(parsed.nodes) ? (parsed.nodes as WorkflowDefinition['nodes']) : [],
      edges: Array.isArray(parsed.edges) ? (parsed.edges as WorkflowDefinition['edges']) : [],
    }
  } catch {
    return { nodes: [], edges: [] }
  }
}

function toWorkflowDefinition(raw: RawWorkflow): WorkflowDefinition {
  const { nodes, edges } = parseWorkflowDefinition(raw.definition)
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    nodes,
    edges,
    currentSeq: raw.currentSeq ?? 0,
    enabled: raw.enabled ?? false,
    activeVersionId: raw.activeVersionId ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

export function createHttpClient(options: HttpClientOptions = {}): ApiClient {
  const {
    baseURL = '/api',
    getToken = () => null,
    credentials = 'include',
    onUnauthorized,
    onError,
    requestInterceptors = [],
    responseInterceptors = [],
  } = options

  const request = async <T>(
    method: string,
    path: string,
    body?: unknown,
    reqOptions?: { skipJSON?: boolean },
  ): Promise<T> => {
    let ctx: RequestContext = {
      method,
      url: `${baseURL}${path}`,
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    }

    const token = getToken()
    if (token) {
      ctx.headers['Authorization'] = `Bearer ${token}`
    }

    for (const interceptor of requestInterceptors) {
      ctx = await interceptor(ctx)
    }

    const response = await fetch(ctx.url, {
      method: ctx.method,
      headers: ctx.headers,
      body: ctx.body ? JSON.stringify(ctx.body) : undefined,
      credentials,
    })

    let resCtx: ResponseContext = {
      status: response.status,
      ok: response.ok,
      json: <T>() => response.json() as Promise<T>,
      text: () => response.text(),
    }

    for (const interceptor of responseInterceptors) {
      resCtx = await interceptor(resCtx)
    }

    if (!resCtx.ok) {
      if (resCtx.status === 401 && onUnauthorized) {
        onUnauthorized()
      }
      const errorBody = await resCtx
        .json<{ error?: string }>()
        .catch((): { error?: string } => ({}))
      const error = new ApiError(resCtx.status, errorBody.error ?? `HTTP ${resCtx.status}`)
      await onError?.(error, resCtx)
      throw error
    }

    if (reqOptions?.skipJSON) return undefined as T
    return resCtx.json<T>()
  }

  const get = <T>(path: string) => request<T>('GET', path)
  const post = <T>(path: string, body?: unknown, skipJSON?: boolean) =>
    request<T>('POST', path, body, { skipJSON })
  const patch = <T>(path: string, body?: unknown, skipJSON?: boolean) =>
    request<T>('PATCH', path, body, { skipJSON })
  const del = <T>(path: string, skipJSON?: boolean) =>
    request<T>('DELETE', path, undefined, { skipJSON })
  const put = <T>(path: string, body?: unknown, skipJSON?: boolean) =>
    request<T>('PUT', path, body, { skipJSON })

  return {
    getQuote: (symbol: string) => get(`/data/quote?symbol=${encodeURIComponent(symbol)}`),
    getKlines: ({ symbol, interval, from, to, limit }) => {
      const params = new URLSearchParams({ symbol, interval })
      if (from !== undefined) params.set('from', String(from))
      if (to !== undefined) params.set('to', String(to))
      if (limit !== undefined) params.set('limit', String(limit))
      return get(`/data/kline?${params.toString()}`)
    },
    searchNews: ({ query, language, limit }) => {
      const params = new URLSearchParams({ query })
      if (language) params.set('language', language)
      if (limit !== undefined) params.set('limit', String(limit))
      return get(`/data/news?${params.toString()}`)
    },

    listWorkflows: async () => {
      const res = await get<{ workflows: RawWorkflow[] }>('/workflows')
      return res.workflows.map(toWorkflowDefinition)
    },
    getWorkflow: async (id: string) => {
      const res = await get<{ workflow: RawWorkflow }>(`/workflows/${encodeURIComponent(id)}`)
      return toWorkflowDefinition(res.workflow)
    },
    createWorkflow: async (params: { name: string; definition: string }) => {
      const res = await post<{ workflow: RawWorkflow }>('/workflows', params)
      return { workflow: toWorkflowDefinition(res.workflow) }
    },
    updateWorkflowMeta: async (id, params) => {
      const res = await patch<{ workflow: RawWorkflow }>(
        `/workflows/${encodeURIComponent(id)}/meta`,
        params,
      )
      return { workflow: toWorkflowDefinition(res.workflow) }
    },
    saveWorkflow: async (workflow) => {
      const definition = JSON.stringify({ nodes: workflow.nodes, edges: workflow.edges })
      await put(`/workflows/${encodeURIComponent(workflow.id)}`, { definition }, true)
    },
    applyWorkflowOps: async (workflowId, request) => {
      const res = await patch<{
        workflow: RawWorkflow
        appliedOps: number
        warnings: string[]
      }>(`/workflows/${encodeURIComponent(workflowId)}`, request)
      return {
        workflow: toWorkflowDefinition(res.workflow),
        appliedOps: res.appliedOps,
        warnings: res.warnings,
      }
    },
    applyWorkflowEvent: async (workflowId, request) => {
      const res = await post<{
        workflow: RawWorkflow
        event: WorkflowEditEvent
        warnings: string[]
      }>(`/workflows/${encodeURIComponent(workflowId)}/events/batch`, request)
      return {
        workflow: toWorkflowDefinition(res.workflow),
        event: res.event,
        warnings: res.warnings,
      }
    },
    getWorkflowHistory: (workflowId) => get(`/workflows/${encodeURIComponent(workflowId)}/history`),
    undoWorkflow: async (workflowId) => {
      const res = await post<{
        workflow: RawWorkflow
        event: WorkflowEditEvent
        warnings: string[]
      }>(`/workflows/${encodeURIComponent(workflowId)}/undo`)
      return {
        workflow: toWorkflowDefinition(res.workflow),
        event: res.event,
        warnings: res.warnings,
      }
    },
    redoWorkflow: async (workflowId) => {
      const res = await post<{
        workflow: RawWorkflow
        event: WorkflowEditEvent
        warnings: string[]
      }>(`/workflows/${encodeURIComponent(workflowId)}/redo`)
      return {
        workflow: toWorkflowDefinition(res.workflow),
        event: res.event,
        warnings: res.warnings,
      }
    },
    createWorkflowSnapshot: async (workflowId, request) => {
      const res = await post<{ workflow: RawWorkflow; snapshot: WorkflowEditEvent }>(
        `/workflows/${encodeURIComponent(workflowId)}/snapshots`,
        request,
      )
      return { workflow: toWorkflowDefinition(res.workflow), snapshot: res.snapshot }
    },
    listWorkflowSnapshots: (workflowId) =>
      get(`/workflows/${encodeURIComponent(workflowId)}/snapshots`),
    restoreWorkflowSnapshot: async (workflowId, eventId) => {
      const res = await post<{ workflow: RawWorkflow; event: WorkflowEditEvent }>(
        `/workflows/${encodeURIComponent(workflowId)}/snapshots/${encodeURIComponent(eventId)}/restore`,
      )
      return { workflow: toWorkflowDefinition(res.workflow), event: res.event }
    },
    deleteWorkflow: (id: string) => del(`/workflows/${encodeURIComponent(id)}`, true),
    setWorkflowEnabled: async (id, enabled) => {
      const res = await patch<{ workflow: RawWorkflow }>(
        `/workflows/${encodeURIComponent(id)}/status`,
        { enabled },
      )
      return { workflow: toWorkflowDefinition(res.workflow) }
    },
    publishWorkflow: (id, params) =>
      post(`/workflows/${encodeURIComponent(id)}/publish`, params ?? {}),
    listWorkflowVersions: (workflowId) =>
      get(`/workflows/${encodeURIComponent(workflowId)}/versions`),
    setActiveWorkflowVersion: async (workflowId, versionId) => {
      const res = await post<{ workflow: RawWorkflow }>(
        `/workflows/${encodeURIComponent(workflowId)}/versions/${encodeURIComponent(versionId)}/activate`,
      )
      return { workflow: toWorkflowDefinition(res.workflow) }
    },
    restoreWorkflowVersionToDraft: async (workflowId, versionId) => {
      const res = await post<{ workflow: RawWorkflow; event: WorkflowEditEvent }>(
        `/workflows/${encodeURIComponent(workflowId)}/versions/${encodeURIComponent(versionId)}/restore-draft`,
      )
      return { workflow: toWorkflowDefinition(res.workflow), event: res.event }
    },
    executeWorkflow: (id: string, request?: ExecuteWorkflowRequest) =>
      post(`/workflows/${encodeURIComponent(id)}/execute`, request),

    getExecution: (id: string) => get(`/executions/${encodeURIComponent(id)}`),
    cancelExecution: (id: string) =>
      post(`/executions/${encodeURIComponent(id)}/cancel`, undefined, true),

    runWorkflowNode: (workflowId: string, nodeId: string) =>
      post(`/workflows/${encodeURIComponent(workflowId)}/nodes/${encodeURIComponent(nodeId)}/run`),
    getNodeLastExecution: (workflowId: string, nodeId: string) =>
      get(
        `/workflows/${encodeURIComponent(workflowId)}/nodes/${encodeURIComponent(nodeId)}/last-execution`,
      ),
    getWorkflowVariables: (workflowId: string) =>
      get(`/workflows/${encodeURIComponent(workflowId)}/variables`),
    getWorkflowExecutions: (workflowId: string, limit?: number) => {
      const params = limit !== undefined ? `?limit=${limit}` : ''
      return get(`/workflows/${encodeURIComponent(workflowId)}/executions${params}`)
    },
    getWorkflowRuns: (workflowId: string, limit?: number) => {
      const params = limit !== undefined ? `?limit=${limit}` : ''
      return get(`/workflows/${encodeURIComponent(workflowId)}/runs${params}`)
    },
    getWorkflowRun: (workflowId: string, runId: string) =>
      get(`/workflows/${encodeURIComponent(workflowId)}/runs/${encodeURIComponent(runId)}`),

    getWatchedAssets: () => get('/assets'),
    addAsset: (asset) => post('/assets', asset, true),
    removeAsset: (id: string) => del(`/assets/${encodeURIComponent(id)}`, true),

    me: () => get('/auth/me'),
    login: ({ email, password }) => post('/auth/login', { email, password }, true),
    logout: () => post('/auth/logout', undefined, true),

    getModelSettings: () => get('/model-settings'),
    updateModelSettings: (params) => patch('/model-settings', params, true),

    listKnowledgeBases: () => get('/knowledge-bases'),
    getKnowledgeBase: (id: string) => get(`/knowledge-bases/${encodeURIComponent(id)}`),
    createKnowledgeBase: (params) => post('/knowledge-bases', params),
    updateKnowledgeBase: (id, params) =>
      patch(`/knowledge-bases/${encodeURIComponent(id)}`, params, true),
    deleteKnowledgeBase: (id: string) => del(`/knowledge-bases/${encodeURIComponent(id)}`, true),
    listKnowledgeDocuments: (knowledgeBaseId: string) =>
      get(`/knowledge-bases/${encodeURIComponent(knowledgeBaseId)}/documents`),
    createKnowledgeDocument: (knowledgeBaseId, params) =>
      post(`/knowledge-bases/${encodeURIComponent(knowledgeBaseId)}/documents`, params, true),
    deleteKnowledgeDocument: (documentId: string) =>
      del(`/knowledge-bases/documents/${encodeURIComponent(documentId)}`, true),

    listProviders: () => get('/providers'),
    getProvider: (id: string) => get(`/providers/${encodeURIComponent(id)}`),
    createProvider: (params) => post('/providers', params),
    updateProvider: (id, params) => patch(`/providers/${encodeURIComponent(id)}`, params),
    deleteProvider: (id: string) => del(`/providers/${encodeURIComponent(id)}`, true),
    testProvider: (id: string) => post(`/providers/${encodeURIComponent(id)}/test`),
    syncProvider: (id: string) => post(`/providers/${encodeURIComponent(id)}/sync`),
    listProviderTemplates: () => get('/provider-templates'),
    addProviderModel: (providerId, params) =>
      post(`/providers/${encodeURIComponent(providerId)}/models`, params, true),
    updateProviderModel: (providerId, modelId, params) =>
      patch(
        `/providers/${encodeURIComponent(providerId)}/models/${encodeURIComponent(modelId)}`,
        params,
        true,
      ),
    deleteProviderModel: (providerId, modelId) =>
      del(
        `/providers/${encodeURIComponent(providerId)}/models/${encodeURIComponent(modelId)}`,
        true,
      ),

    listDataSourceProviders: () => get('/data-source-providers'),
    getDataSourceProviderOptions: (providerId: string, fieldKey: string, query?: string) => {
      const params = new URLSearchParams()
      if (query) params.set('query', query)
      const suffix = params.toString() ? `?${params.toString()}` : ''
      return get(
        `/data-source-providers/${encodeURIComponent(providerId)}/options/${encodeURIComponent(fieldKey)}${suffix}`,
      )
    },
    listDataSourceInstances: () => get('/data-source-instances'),
    getDataSourceInstance: (id: string) => get(`/data-source-instances/${encodeURIComponent(id)}`),
    createDataSourceInstance: (params) => post('/data-source-instances', params, true),
    deleteDataSourceInstance: (id: string) =>
      del(`/data-source-instances/${encodeURIComponent(id)}`, true),
    testDataSourceInstance: (id: string) =>
      post(`/data-source-instances/${encodeURIComponent(id)}/test`),
    getDataSourceInstanceSymbols: (instanceId: string, query: string | undefined) =>
      post(`/data-source-instances/${encodeURIComponent(instanceId)}/symbols`, { query }),
    getDataSourceInstanceIntervals: (instanceId: string) =>
      get(`/data-source-instances/${encodeURIComponent(instanceId)}/intervals`),
    getDataSourceInstanceIntervalSupport: (instanceId: string, intervals: string[]) =>
      post(`/data-source-instances/${encodeURIComponent(instanceId)}/interval-support`, {
        intervals,
      }),
    addDataSourceSymbol: (instanceId, params) =>
      post(`/data-source-instances/${encodeURIComponent(instanceId)}/symbols`, params, true),
    getDataSourceKlines: (instanceId, params) =>
      post(`/data-source-instances/${encodeURIComponent(instanceId)}/klines`, params),
    getDataSourceDrawings: (instanceId, symbol) => {
      const params = new URLSearchParams({ symbol })
      return get(
        `/data-source-instances/${encodeURIComponent(instanceId)}/drawings?${params.toString()}`,
      )
    },
    saveDataSourceDrawings: (instanceId, params) =>
      put(`/data-source-instances/${encodeURIComponent(instanceId)}/drawings`, params),
    getChartConfig: () => get('/chart/config'),
    updateChartConfig: (params) => patch('/chart/config', params),

    listWorkspaceLayouts: () => get('/workspace/layouts'),
    getWorkspaceLayout: (id: string) => get(`/workspace/layouts/${encodeURIComponent(id)}`),
    createWorkspaceLayout: (params) => post('/workspace/layouts', params),
    saveWorkspaceLayout: (id: string, params: { schemaJson: unknown; name?: string }) =>
      put(`/workspace/layouts/${encodeURIComponent(id)}`, params, true),
    deleteWorkspaceLayout: (id: string) => del(`/workspace/layouts/${encodeURIComponent(id)}`),
    activateWorkspaceLayout: (id: string) =>
      post(`/workspace/layouts/${encodeURIComponent(id)}/activate`, undefined, true),

    listAgents: () => get('/agents'),
    createAgent: (params) => post('/agents', params),
    updateAgent: (id, params) => patch(`/agents/${encodeURIComponent(id)}`, params),
    deleteAgent: (id: string) => del(`/agents/${encodeURIComponent(id)}`),
    listAgentSessions: () => get('/agents/sessions'),
    createAgentSession: (params) => post('/agents/sessions', params),
    getAgentSession: (id: string) => get(`/agents/sessions/${encodeURIComponent(id)}`),
    deleteAgentSession: (id: string) => del(`/agents/sessions/${encodeURIComponent(id)}`, true),
    listAgentMemories: (params = {}) => {
      const query = new URLSearchParams()
      if (params.agentId) query.set('agentId', params.agentId)
      if (params.sessionId) query.set('sessionId', params.sessionId)
      if (params.query) query.set('query', params.query)
      const suffix = query.toString() ? `?${query.toString()}` : ''
      return get(`/agents/memories${suffix}`)
    },
    createAgentMemory: (params) => post('/agents/memories', params),
  }
}

/* ── SSE ─────────────────────────────────────────────── */

export interface SSEEvent {
  type: string
  data: unknown
}

export interface StreamSSEOptions {
  baseURL?: string
  getToken?: () => string | null
  credentials?: RequestCredentials
}

export async function* streamSSE(
  path: string,
  body?: unknown,
  options: StreamSSEOptions = {},
): AsyncGenerator<SSEEvent> {
  const { baseURL = '/api', getToken, credentials = 'include' } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  }

  const token = getToken?.()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${baseURL}${path}`, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials,
  })

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(errorBody.error ?? `HTTP ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('Response body is not readable')

  const decoder = new TextDecoder()
  let buffer = ''
  let eventType = 'message'

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          const raw = line.slice(5).trim()
          let data: unknown
          try {
            data = JSON.parse(raw)
          } catch {
            data = raw
          }
          yield { type: eventType, data }
          eventType = 'message'
        } else if (line === '') {
          eventType = 'message'
        }
      }
    }

    if (buffer.trim()) {
      const lines = buffer.split('\n')
      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          const raw = line.slice(5).trim()
          let data: unknown
          try {
            data = JSON.parse(raw)
          } catch {
            data = raw
          }
          yield { type: eventType, data }
          eventType = 'message'
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
