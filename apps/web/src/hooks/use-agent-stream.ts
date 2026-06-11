import { useState, useCallback, useRef } from 'react'
import { streamSSE, type SSEEvent } from '@eous/api-client-http'
import { api } from '../lib/api'

export interface AgentStreamState {
  events: SSEEvent[]
  text: string
  isStreaming: boolean
  error: string | null
}

/**
 * Minimal hook for subscribing to SSE streams.
 * Parses pi-ai streaming events (text_delta, done, error) into a reactive state.
 * Future batches will extend this for chat bubbles / agent UI.
 */
export function useAgentStream() {
  const [state, setState] = useState<AgentStreamState>({
    events: [],
    text: '',
    isStreaming: false,
    error: null,
  })
  const abortRef = useRef<AbortController | null>(null)

  const start = useCallback(async (path: string, body?: unknown) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setState({ events: [], text: '', isStreaming: true, error: null })

    try {
      const token = (api as unknown as { getToken?: () => string | null }).getToken?.() ?? null
      const events: SSEEvent[] = []
      let text = ''

      for await (const event of streamSSE(path, body, {
        baseURL: '/api',
        getToken: () => token,
      })) {
        if (controller.signal.aborted) break

        events.push(event)

        if (
          event.type === 'text_delta' &&
          typeof event.data === 'object' &&
          event.data !== null &&
          'delta' in event.data
        ) {
          text += (event.data as { delta: string }).delta
        }

        setState({ events: [...events], text, isStreaming: true, error: null })
      }

      setState({ events, text, isStreaming: false, error: null })
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setState((prev) => ({
        ...prev,
        isStreaming: false,
        error: err instanceof Error ? err.message : String(err),
      }))
    }
  }, [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setState((prev) => ({ ...prev, isStreaming: false }))
  }, [])

  return { ...state, start, stop }
}
