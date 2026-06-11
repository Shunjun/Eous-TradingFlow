/** Generic SSE event shape */
export interface SSEEvent {
  type: string
  data: unknown
}

export interface StreamSSEOptions {
  baseURL?: string
  getToken?: () => string | null
  credentials?: RequestCredentials
}

/**
 * Subscribe to an SSE stream via POST.
 * Uses fetch + ReadableStream (not EventSource) so POST bodies are supported.
 */
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

    // Process remaining buffer
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
