import type { HttpClientOptions, RequestContext, ResponseContext } from './types.js'
import { ApiError } from './types.js'

export interface HttpHelpers {
  get<T>(path: string): Promise<T>
  post<T>(path: string, body?: unknown, skipJSON?: boolean): Promise<T>
  put<T>(path: string, body?: unknown, skipJSON?: boolean): Promise<T>
  patch<T>(path: string, body?: unknown, skipJSON?: boolean): Promise<T>
  del<T>(path: string, skipJSON?: boolean): Promise<T>
}

export function createHttpHelpers(options: HttpClientOptions = {}): HttpHelpers {
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
      throw new ApiError(resCtx.status, errorBody.error ?? `HTTP ${resCtx.status}`)
    }

    if (reqOptions?.skipJSON) return undefined as T
    return resCtx.json<T>()
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: unknown, skipJSON?: boolean) =>
      request<T>('POST', path, body, { skipJSON }),
    put: <T>(path: string, body?: unknown, skipJSON?: boolean) =>
      request<T>('PUT', path, body, { skipJSON }),
    patch: <T>(path: string, body?: unknown, skipJSON?: boolean) =>
      request<T>('PATCH', path, body, { skipJSON }),
    del: <T>(path: string, skipJSON?: boolean) =>
      request<T>('DELETE', path, undefined, { skipJSON }),
  }
}
