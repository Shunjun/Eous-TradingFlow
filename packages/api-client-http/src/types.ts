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
