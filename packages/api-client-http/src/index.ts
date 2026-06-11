import type { ApiClient } from '@eous/api-client'
import type { WorkflowDefinition } from '@eous/types'

export type { ApiClient } from '@eous/api-client'
export { streamSSE } from './stream'
export type { SSEEvent, StreamSSEOptions } from './stream'

/* ── Error class ──────────────────────────────────────── */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/* ── Interceptor types ────────────────────────────────── */

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

export interface HttpClientOptions {
  baseURL?: string
  getToken?: () => string | null
  credentials?: RequestCredentials
  onUnauthorized?: () => void
  requestInterceptors?: RequestInterceptor[]
  responseInterceptors?: ResponseInterceptor[]
}

/* ── Workflow response transformer ──────────────────────── */

interface RawWorkflow {
  id: string
  name: string
  description?: string
  definition: string
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
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed.edges) ? parsed.edges : [],
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
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

/* ── Client factory ───────────────────────────────────── */

export function createHttpClient(options: HttpClientOptions = {}): ApiClient {
  const {
    baseURL = '/api',
    getToken = () => null,
    credentials = 'include',
    onUnauthorized,
    requestInterceptors = [],
    responseInterceptors = [],
  } = options

  const request = async <T>(
    method: string,
    path: string,
    body?: unknown,
    options?: { skipJSON?: boolean },
  ): Promise<T> => {
    // Build initial context
    let ctx: RequestContext = {
      method,
      url: `${baseURL}${path}`,
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    }

    // Inject token
    const token = getToken()
    if (token) {
      ctx.headers['Authorization'] = `Bearer ${token}`
    }

    // Run request interceptors
    for (const interceptor of requestInterceptors) {
      ctx = await interceptor(ctx)
    }

    const response = await fetch(ctx.url, {
      method: ctx.method,
      headers: ctx.headers,
      body: ctx.body ? JSON.stringify(ctx.body) : undefined,
      credentials,
    })

    // Build response context
    let resCtx: ResponseContext = {
      status: response.status,
      ok: response.ok,
      json: <T>() => response.json() as Promise<T>,
      text: () => response.text(),
    }

    // Run response interceptors
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
      throw new ApiError(resCtx.status, errorBody.error ?? `HTTP ${resCtx.status}`)
    }

    if (options?.skipJSON) return undefined as T
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
    // ── Data APIs ──
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

    // ── Workflow APIs ──
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
    saveWorkflow: async (workflow) => {
      const definition = JSON.stringify({ nodes: workflow.nodes, edges: workflow.edges })
      await put(
        `/workflows/${encodeURIComponent(workflow.id)}`,
        { name: workflow.name, definition },
        true,
      )
    },
    deleteWorkflow: (id: string) => del(`/workflows/${encodeURIComponent(id)}`, true),
    executeWorkflow: (id: string) => post(`/workflows/${encodeURIComponent(id)}/execute`),

    // ── Execution APIs ──
    getExecution: (id: string) => get(`/executions/${encodeURIComponent(id)}`),
    cancelExecution: (id: string) =>
      post(`/executions/${encodeURIComponent(id)}/cancel`, undefined, true),

    // ── Node Execution APIs ──
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

    // ── Asset APIs ──
    getWatchedAssets: () => get('/assets'),
    addAsset: (asset) => post('/assets', asset, true),
    removeAsset: (id: string) => del(`/assets/${encodeURIComponent(id)}`, true),

    // ── Auth APIs ──
    me: () => get('/auth/me'),
    login: ({ email, password }) => post('/auth/login', { email, password }, true),
    logout: () => post('/auth/logout', undefined, true),

    // ── Provider APIs ──
    listProviders: () => get('/providers'),
    getProvider: (id: string) => get(`/providers/${encodeURIComponent(id)}`),
    createProvider: (params) => post('/providers', params),
    deleteProvider: (id: string) => del(`/providers/${encodeURIComponent(id)}`, true),
    testProvider: (id: string) => post(`/providers/${encodeURIComponent(id)}/test`),
    syncProvider: (id: string) =>
      post(`/providers/${encodeURIComponent(id)}/sync`, undefined, true),
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

    // ── Data Source APIs ──
    listDataSourceProviders: () => get('/data-source-providers'),
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
    addDataSourceSymbol: (instanceId, params) =>
      post(`/data-source-instances/${encodeURIComponent(instanceId)}/symbols`, params, true),
    getDataSourceKlines: (instanceId, params) =>
      post(`/data-source-instances/${encodeURIComponent(instanceId)}/klines`, params),

    // ── Workspace APIs ──
    listWorkspaceLayouts: () => get('/workspace/layouts'),
    getWorkspaceLayout: (id: string) => get(`/workspace/layouts/${encodeURIComponent(id)}`),
    createWorkspaceLayout: (params) => post('/workspace/layouts', params),
    saveWorkspaceLayout: (id: string, params: { schemaJson: unknown; name?: string }) =>
      put(`/workspace/layouts/${encodeURIComponent(id)}`, params, true),
    deleteWorkspaceLayout: (id: string) => del(`/workspace/layouts/${encodeURIComponent(id)}`),
    activateWorkspaceLayout: (id: string) =>
      post(`/workspace/layouts/${encodeURIComponent(id)}/activate`, undefined, true),
  }
}
