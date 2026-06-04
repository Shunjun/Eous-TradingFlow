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
  options?: { label: string; value: string }[]
  default?: unknown
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
  saveWorkflow(workflow: WorkflowDefinition): Promise<void>
  deleteWorkflow(id: string): Promise<void>

  // ── Execution APIs ──
  executeWorkflow(id: string): Promise<ExecutionRecord>
  cancelExecution(id: string): Promise<void>
  getExecution(id: string): Promise<ExecutionRecord>

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
  listDataSourceInstances(): Promise<{ instances: DataSourceInstance[] }>
  getDataSourceInstance(id: string): Promise<{ instance: DataSourceDetail }>
  createDataSourceInstance(params: {
    name: string
    providerKind: string
    config: Record<string, unknown>
  }): Promise<void>
  deleteDataSourceInstance(id: string): Promise<void>
  testDataSourceInstance(id: string): Promise<{ ok: boolean; error?: string }>
  listDataSourceProviders(): Promise<{ providers: DataSourceProvider[] }>
  getDefaultSymbols(
    instanceId: string,
    params: { offset?: number; limit?: number },
  ): Promise<{ symbols: SymbolSearchResult[]; total: number }>
  searchDataSourceSymbols(
    instanceId: string,
    params: { query: string },
  ): Promise<{ symbols: SymbolSearchResult[] } | { results: SymbolSearchResult[] }>
  addDataSourceSymbol(
    instanceId: string,
    params: {
      symbol: string
      name: string
      exchange?: string
      type?: string
    },
  ): Promise<void>
  getDataSourceIntervals(
    instanceId: string,
  ): Promise<{ intervals: { value: string; label: string }[] }>
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
}
