import type { ApiClient } from '@eous/api-client'

export function createHttpClient(
  baseURL = '/api',
  getToken: () => string | null = () => null
): ApiClient {
  const request = async <T>(
    method: string,
    path: string,
    body?: unknown,
    options?: { skipJSON?: boolean }
  ): Promise<T> => {
    const token = getToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${baseURL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    if (options?.skipJSON) return undefined as T
    return response.json()
  }

  const get = <T>(path: string) => request<T>('GET', path)
  const post = <T>(path: string, body?: unknown, skipJSON?: boolean) => request<T>('POST', path, body, { skipJSON })
  const del = <T>(path: string, skipJSON?: boolean) => request<T>('DELETE', path, undefined, { skipJSON })

  return {
    // Data APIs
    getQuote: (symbol: string) => 
      get(`/data/quote?symbol=${encodeURIComponent(symbol)}`),

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

    // Workflow APIs
    listWorkflows: () => get('/workflows'),

    getWorkflow: (id: string) => get(`/workflows/${encodeURIComponent(id)}`),

    saveWorkflow: (workflow) => post('/workflows', workflow, true),

    deleteWorkflow: (id: string) => del(`/workflows/${encodeURIComponent(id)}`, true),

    executeWorkflow: (id: string) => post(`/workflows/${encodeURIComponent(id)}/execute`),

    // Execution APIs
    getExecution: (id: string) => get(`/executions/${encodeURIComponent(id)}`),

    cancelExecution: (id: string) => post(`/executions/${encodeURIComponent(id)}/cancel`, undefined, true),

    // Asset APIs
    getWatchedAssets: () => get('/assets'),

    addAsset: (asset) => post('/assets', asset, true),

    removeAsset: (id: string) => del(`/assets/${encodeURIComponent(id)}`, true),
  }
}
