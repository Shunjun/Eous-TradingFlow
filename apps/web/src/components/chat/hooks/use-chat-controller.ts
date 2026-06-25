import { useCallback, useEffect } from 'react'
import type { AgentMessage, AgentSessionSummary } from '@eous/api-client'
import { useAgentStream } from '../../../hooks/use-agent-stream'
import { api } from '../../../lib/api'
import { selectSelectedAgent, useChatStore, useChatStoreApi } from '../store'

const STREAMING_MESSAGE_ID = 'streaming-assistant-message'

function pickDoneMessage(data: unknown): AgentMessage | null {
  if (!data || typeof data !== 'object' || !('message' in data)) return null
  const message = (data as { message: unknown }).message
  if (!message || typeof message !== 'object') return null
  return message as AgentMessage
}

function pickSession(data: unknown): AgentSessionSummary | null {
  if (!data || typeof data !== 'object' || !('session' in data)) return null
  const session = (data as { session: unknown }).session
  if (!session || typeof session !== 'object') return null
  return session as AgentSessionSummary
}

function upsertSession(
  sessions: AgentSessionSummary[],
  nextSession: AgentSessionSummary,
): AgentSessionSummary[] {
  const exists = sessions.some((session) => session.id === nextSession.id)
  return exists
    ? sessions.map((session) => (session.id === nextSession.id ? nextSession : session))
    : [nextSession, ...sessions]
}

export function useChatController() {
  const store = useChatStoreApi()
  const activeSessionId = useChatStore((state) => state.activeSessionId)
  const agents = useChatStore((state) => state.agents)
  const input = useChatStore((state) => state.input)
  const selectedAgent = useChatStore(selectSelectedAgent)
  const selectedProviderId = useChatStore((state) => state.selectedProviderId)
  const selectedModelId = useChatStore((state) => state.selectedModelId)
  const streamingSessionId = useChatStore((state) => state.streamingSessionId)
  const stream = useAgentStream()
  const { isStreaming, start } = stream

  useEffect(() => {
    store.getState().setIsStreaming(isStreaming)
  }, [isStreaming, store])

  const loadShell = useCallback(async () => {
    const state = store.getState()
    state.setLoading(true)
    state.setError(null)
    try {
      const [agentRes, sessionRes, providerRes] = await Promise.all([
        api.listAgents(),
        api.listAgentSessions(),
        api.listProviders(),
      ])
      const modelEntries = await Promise.all(
        providerRes.providers.map(async (provider) => {
          try {
            const res = await api.getProvider(provider.id)
            return [provider.id, res.models.filter((model) => model.enabled)] as const
          } catch {
            return [provider.id, []] as const
          }
        }),
      )
      store.getState().loadShellSuccess(agentRes.agents, sessionRes.sessions, providerRes.providers)
      store.getState().setModelsByProviderId(Object.fromEntries(modelEntries))
    } catch (err) {
      store.getState().setError(err instanceof Error ? err.message : 'Failed to load chat')
    } finally {
      store.getState().setLoading(false)
    }
  }, [store])

  useEffect(() => {
    void loadShell()
  }, [loadShell])

  useEffect(() => {
    if (!selectedAgent) return
    const state = store.getState()
    if (!state.selectedProviderId && !state.selectedModelId) {
      state.selectAgent(selectedAgent.id)
    }
  }, [selectedAgent, store])

  useEffect(() => {
    if (!activeSessionId) {
      store.getState().setMessages([])
      return
    }
    if (activeSessionId === streamingSessionId) return

    const sessionId = activeSessionId
    let cancelled = false
    async function loadSession() {
      store.getState().setError(null)
      try {
        const sessionRes = await api.getAgentSession(sessionId)
        if (cancelled) return

        const sessionAgent = store
          .getState()
          .agents.find((agent) => agent.id === sessionRes.session.agentId)
        store.getState().setMessages(sessionRes.messages)
        if (sessionAgent) store.getState().selectAgent(sessionAgent.id)
      } catch (err) {
        if (!cancelled) {
          store.getState().setError(err instanceof Error ? err.message : 'Failed to load session')
        }
      }
    }

    void loadSession()
    return () => {
      cancelled = true
    }
  }, [activeSessionId, agents, store, streamingSessionId])

  const sendMessage = useCallback(async () => {
    const content = input.trim()
    if (!content || isStreaming) return

    const state = store.getState()
    state.setInput('')
    state.setError(null)
    state.setStreamingSessionId(activeSessionId)

    const now = new Date().toISOString()
    const optimisticUser: AgentMessage = {
      id: `local-user-${Date.now()}`,
      sessionId: activeSessionId ?? 'pending',
      role: 'user',
      content,
      metadata: {},
      createdAt: now,
    }
    const optimisticAssistant: AgentMessage = {
      id: STREAMING_MESSAGE_ID,
      sessionId: activeSessionId ?? 'pending',
      role: 'assistant',
      content: '',
      metadata: {},
      createdAt: now,
    }
    state.setMessages((current) => [...current, optimisticUser, optimisticAssistant])

    await start(
      '/agents/chat',
      {
        agentId: selectedAgent?.id ?? undefined,
        sessionId: activeSessionId ?? undefined,
        providerId: selectedProviderId || undefined,
        modelId: selectedModelId || undefined,
        message: content,
      },
      {
        onEvent: (event) => {
          if (event.type !== 'session' && event.type !== 'session_updated') return
          const nextSession = pickSession(event.data)
          if (!nextSession) return

          const nextState = store.getState()
          if (event.type === 'session') {
            nextState.setStreamingSessionId(nextSession.id)
            nextState.setActiveSessionId(nextSession.id)
          }
          nextState.setSessions((current) => upsertSession(current, nextSession))
        },
        onTextDelta: (delta) => {
          store
            .getState()
            .setMessages((current) =>
              current.map((message) =>
                message.id === STREAMING_MESSAGE_ID
                  ? { ...message, content: message.content + delta }
                  : message,
              ),
            )
        },
        onDone: (event) => {
          const doneMessage = pickDoneMessage(event.data)
          store.getState().setStreamingSessionId(null)
          if (!doneMessage) return
          store
            .getState()
            .setMessages((current) =>
              current.map((message) =>
                message.id === STREAMING_MESSAGE_ID ? doneMessage : message,
              ),
            )
        },
        onError: (message) => {
          store.getState().setStreamingSessionId(null)
          store.getState().setError(message)
        },
      },
    )
  }, [
    activeSessionId,
    input,
    isStreaming,
    selectedAgent?.id,
    selectedModelId,
    selectedProviderId,
    start,
    store,
  ])

  useEffect(() => {
    store.getState().setSendMessage(sendMessage)
  }, [sendMessage, store])
}
