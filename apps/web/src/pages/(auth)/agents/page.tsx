import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  AgentMemory,
  AgentMessage,
  AgentSessionSummary,
  AgentSummary,
  Provider,
  ProviderModel,
} from '@eous/api-client'
import { Badge, Button, CardPanel, CardPanelBody, Input, Label, Textarea, cn } from '@eous/ui'
import {
  BrainCircuit,
  Clock3,
  Database,
  Plus,
  MessageSquarePlus,
  RefreshCw,
  Send,
  Save,
  Sparkles,
} from 'lucide-react'
import { api } from '../../../lib/api'
import { useAgentStream } from '../../../hooks/use-agent-stream'

const STREAMING_MESSAGE_ID = 'streaming-assistant-message'

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

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

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [sessions, setSessions] = useState<AgentSessionSummary[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [providerModels, setProviderModels] = useState<ProviderModel[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [memories, setMemories] = useState<AgentMemory[]>([])
  const [agentDraft, setAgentDraft] = useState({
    name: '',
    description: '',
    systemPrompt: '',
    providerId: '',
    modelId: '',
  })
  const [memoryDraft, setMemoryDraft] = useState({
    kind: 'preference',
    content: '',
    importance: 1,
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingAgent, setSavingAgent] = useState(false)
  const [savingMemory, setSavingMemory] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stream = useAgentStream()

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? agents[0] ?? null,
    [agents, selectedAgentId],
  )
  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions],
  )
  const activeAgent = useMemo(
    () => agents.find((agent) => agent.id === activeSession?.agentId) ?? selectedAgent,
    [agents, activeSession, selectedAgent],
  )

  const refreshShell = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [agentRes, sessionRes] = await Promise.all([api.listAgents(), api.listAgentSessions()])
      setAgents(agentRes.agents)
      setSessions(sessionRes.sessions)
      setSelectedAgentId((current) => current ?? agentRes.agents[0]?.id ?? null)
      setActiveSessionId((current) => current ?? sessionRes.sessions[0]?.id ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedAgent) {
      setAgentDraft({ name: '', description: '', systemPrompt: '', providerId: '', modelId: '' })
      return
    }
    setAgentDraft({
      name: selectedAgent.name,
      description: selectedAgent.description ?? '',
      systemPrompt: selectedAgent.systemPrompt ?? '',
      providerId: selectedAgent.providerId ?? '',
      modelId: selectedAgent.modelId ?? '',
    })
  }, [selectedAgent])

  useEffect(() => {
    let cancelled = false
    async function loadProviders() {
      try {
        const res = await api.listProviders()
        if (!cancelled) setProviders(res.providers)
      } catch {
        if (!cancelled) setProviders([])
      }
    }
    void loadProviders()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!agentDraft.providerId) {
      setProviderModels([])
      return
    }

    let cancelled = false
    async function loadModels() {
      try {
        const res = await api.getProvider(agentDraft.providerId)
        if (!cancelled) setProviderModels(res.models)
      } catch {
        if (!cancelled) setProviderModels([])
      }
    }
    void loadModels()
    return () => {
      cancelled = true
    }
  }, [agentDraft.providerId])

  useEffect(() => {
    void refreshShell()
  }, [refreshShell])

  useEffect(() => {
    if (!activeSessionId) {
      setMessages([])
      setMemories([])
      return
    }

    let cancelled = false
    async function loadSession() {
      setError(null)
      try {
        const [sessionRes, memoryRes] = await Promise.all([
          api.getAgentSession(activeSessionId as string),
          api.listAgentMemories({
            agentId: selectedAgent?.id,
            sessionId: activeSessionId as string,
          }),
        ])
        if (cancelled) return
        setMessages(sessionRes.messages)
        setMemories(memoryRes.memories)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load session')
      }
    }

    void loadSession()
    return () => {
      cancelled = true
    }
  }, [activeSessionId, selectedAgent?.id])

  useEffect(() => {
    if (!selectedAgent?.id || activeSessionId) return

    let cancelled = false
    async function loadAgentMemories() {
      try {
        const res = await api.listAgentMemories({ agentId: selectedAgent.id })
        if (!cancelled) setMemories(res.memories)
      } catch {
        if (!cancelled) setMemories([])
      }
    }

    void loadAgentMemories()
    return () => {
      cancelled = true
    }
  }, [activeSessionId, selectedAgent?.id])

  const createSession = useCallback(async () => {
    setError(null)
    try {
      const res = await api.createAgentSession({ agentId: selectedAgent?.id ?? activeAgent?.id })
      setSessions((current) => [res.session, ...current])
      setActiveSessionId(res.session.id)
      setMessages([])
      setMemories([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session')
    }
  }, [activeAgent, selectedAgent])

  const createAgent = useCallback(async () => {
    setError(null)
    try {
      const res = await api.createAgent({
        name: 'New Analyst',
        description: 'Isolated analysis agent',
        systemPrompt:
          'You are an analytical assistant for a trading workflow product. Use the provided memory as context only.',
      })
      setAgents((current) => [res.agent, ...current])
      setSelectedAgentId(res.agent.id)
      setActiveSessionId(null)
      setMessages([])
      setMemories([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent')
    }
  }, [])

  const saveAgent = useCallback(async () => {
    if (!selectedAgent) return
    setSavingAgent(true)
    setError(null)
    try {
      const res = await api.updateAgent(selectedAgent.id, {
        name: agentDraft.name,
        description: agentDraft.description,
        systemPrompt: agentDraft.systemPrompt,
        providerId: agentDraft.providerId || null,
        modelId: agentDraft.modelId || null,
      })
      setAgents((current) =>
        current.map((agent) => (agent.id === selectedAgent.id ? res.agent : agent)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save agent')
    } finally {
      setSavingAgent(false)
    }
  }, [agentDraft, selectedAgent])

  const saveMemory = useCallback(async () => {
    if (!selectedAgent || !memoryDraft.content.trim()) return
    setSavingMemory(true)
    setError(null)
    try {
      const res = await api.createAgentMemory({
        agentId: selectedAgent.id,
        sessionId: activeSessionId ?? undefined,
        scope: 'agent',
        kind: memoryDraft.kind.trim() || 'note',
        content: memoryDraft.content.trim(),
        importance: memoryDraft.importance,
      })
      setMemories((current) => [res.memory, ...current])
      setMemoryDraft({ kind: 'preference', content: '', importance: 1 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save memory')
    } finally {
      setSavingMemory(false)
    }
  }, [activeSessionId, memoryDraft, selectedAgent])

  const sendMessage = useCallback(async () => {
    const content = input.trim()
    if (!content || stream.isStreaming) return

    setInput('')
    setError(null)
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
    setMessages((current) => [...current, optimisticUser, optimisticAssistant])

    await stream.start(
      '/agents/chat',
      {
        agentId: selectedAgent?.id ?? undefined,
        sessionId: activeSessionId ?? undefined,
        message: content,
      },
      {
        onEvent: (event) => {
          if (event.type !== 'session') return
          const nextSession = pickSession(event.data)
          if (!nextSession) return
          setActiveSessionId(nextSession.id)
          setSessions((current) => {
            const exists = current.some((session) => session.id === nextSession.id)
            return exists
              ? current.map((session) => (session.id === nextSession.id ? nextSession : session))
              : [nextSession, ...current]
          })
        },
        onTextDelta: (delta) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === STREAMING_MESSAGE_ID
                ? { ...message, content: message.content + delta }
                : message,
            ),
          )
        },
        onDone: (event) => {
          const doneMessage = pickDoneMessage(event.data)
          if (!doneMessage) return
          setMessages((current) =>
            current.map((message) => (message.id === STREAMING_MESSAGE_ID ? doneMessage : message)),
          )
          void api.listAgentSessions().then((res) => setSessions(res.sessions))
        },
        onError: (message) => setError(message),
      },
    )
  }, [activeSessionId, input, selectedAgent?.id, stream])

  return (
    <div className="h-[calc(100vh-72px)] p-4">
      <div className="grid h-full grid-cols-[300px_minmax(0,1fr)_340px] gap-4">
        <CardPanel className="min-h-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <BrainCircuit className="size-4 text-primary" />
              <div>
                <h1 className="text-sm font-semibold">Agents</h1>
                <p className="text-xs text-muted-foreground">{agents.length || 1} runtime</p>
              </div>
            </div>
            <Button size="sm" variant="ghost-icon" onClick={createAgent} title="New agent">
              <Plus className="size-4" />
            </Button>
          </div>
          <CardPanelBody className="h-[calc(100%-57px)] overflow-y-auto p-2">
            {loading ? (
              <div className="p-3 text-xs text-muted-foreground">Loading sessions...</div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="mb-1.5 px-1 text-xs font-medium text-muted-foreground">
                    Isolated agents
                  </div>
                  <div className="space-y-1">
                    {agents.map((agent) => (
                      <button
                        key={agent.id}
                        className={cn(
                          'w-full rounded-md px-3 py-2 text-left transition-colors',
                          selectedAgent?.id === agent.id ? 'bg-muted' : 'hover:bg-muted/60',
                        )}
                        onClick={() => {
                          setSelectedAgentId(agent.id)
                          setActiveSessionId(null)
                          setMessages([])
                        }}
                      >
                        <div className="truncate text-sm font-medium">{agent.name}</div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">
                          {agent.modelId ?? 'default model'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between px-1">
                    <span className="text-xs font-medium text-muted-foreground">Sessions</span>
                    <Button size="xs" variant="ghost" onClick={createSession}>
                      <MessageSquarePlus className="size-3.5" />
                    </Button>
                  </div>
                  {sessions.filter((session) => session.agentId === selectedAgent?.id).length ===
                  0 ? (
                    <button
                      className="w-full rounded-md border border-dashed border-border p-4 text-left text-sm text-muted-foreground hover:bg-muted/40"
                      onClick={createSession}
                    >
                      Start a new conversation
                    </button>
                  ) : null}
                  <div className="space-y-1">
                    {sessions
                      .filter((session) => session.agentId === selectedAgent?.id)
                      .map((session) => (
                        <button
                          key={session.id}
                          className={cn(
                            'w-full rounded-md px-3 py-2 text-left transition-colors',
                            activeSessionId === session.id
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-muted',
                          )}
                          onClick={() => setActiveSessionId(session.id)}
                        >
                          <div className="truncate text-sm font-medium">{session.title}</div>
                          <div
                            className={cn(
                              'mt-1 flex items-center gap-1 text-xs',
                              activeSessionId === session.id
                                ? 'text-primary-foreground/75'
                                : 'text-muted-foreground',
                            )}
                          >
                            <Clock3 className="size-3" />
                            {formatTime(session.updatedAt)}
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </CardPanelBody>
        </CardPanel>

        <CardPanel className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-sm font-semibold">
                  {activeSession?.title ?? 'Agent conversation'}
                </h2>
                <Badge variant="outline" className="shrink-0">
                  {activeAgent?.modelId ?? 'no model'}
                </Badge>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {activeAgent?.name ?? 'Eous Analyst'}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={refreshShell} disabled={loading}>
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
          </div>

          {error ? (
            <div className="border-b border-destructive/20 bg-destructive/10 px-5 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="max-w-md text-center">
                  <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Sparkles className="size-5" />
                  </div>
                  <h3 className="text-sm font-semibold">Ask the Agent to analyze or design.</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Use it for workflow ideas, trading analysis prompts, provider setup, and
                    memory-backed follow-ups.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex',
                      message.role === 'user' ? 'justify-end' : 'justify-start',
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[76%] rounded-md border px-3 py-2 text-sm leading-6',
                        message.role === 'user'
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-muted/35',
                      )}
                    >
                      <div className="whitespace-pre-wrap">{message.content || '...'}</div>
                      <div
                        className={cn(
                          'mt-1 text-[11px]',
                          message.role === 'user'
                            ? 'text-primary-foreground/70'
                            : 'text-muted-foreground',
                        )}
                      >
                        {message.role} · {formatTime(message.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-border p-4">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void sendMessage()
                  }
                }}
                placeholder="Ask about a symbol, a workflow, or what the Agent should remember..."
                className="min-h-11 resize-none"
                disabled={stream.isStreaming}
              />
              <Button
                className="h-11 px-3"
                onClick={() => void sendMessage()}
                disabled={!input.trim() || stream.isStreaming}
                title="Send"
              >
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </CardPanel>

        <CardPanel className="min-h-0 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Database className="size-4 text-primary" />
            <div>
              <h2 className="text-sm font-semibold">Memory</h2>
              <p className="text-xs text-muted-foreground">Injected context</p>
            </div>
          </div>
          <CardPanelBody className="h-[calc(100%-57px)] overflow-y-auto p-3">
            {selectedAgent ? (
              <div className="mb-3 space-y-3 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold">Agent settings</div>
                  <Button size="xs" onClick={saveAgent} disabled={savingAgent}>
                    <Save className="size-3.5" />
                    Save
                  </Button>
                </div>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input
                      className="h-8 text-xs"
                      value={agentDraft.name}
                      onChange={(event) =>
                        setAgentDraft((draft) => ({ ...draft, name: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Description</Label>
                    <Input
                      className="h-8 text-xs"
                      value={agentDraft.description}
                      onChange={(event) =>
                        setAgentDraft((draft) => ({ ...draft, description: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">System Prompt</Label>
                    <Textarea
                      className="min-h-20 text-xs"
                      value={agentDraft.systemPrompt}
                      onChange={(event) =>
                        setAgentDraft((draft) => ({ ...draft, systemPrompt: event.target.value }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Provider</Label>
                      <select
                        className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                        value={agentDraft.providerId}
                        onChange={(event) =>
                          setAgentDraft((draft) => ({
                            ...draft,
                            providerId: event.target.value,
                            modelId: '',
                          }))
                        }
                      >
                        <option value="">Default</option>
                        {providers.map((provider) => (
                          <option key={provider.id} value={provider.id}>
                            {provider.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Model</Label>
                      <select
                        className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                        value={agentDraft.modelId}
                        onChange={(event) =>
                          setAgentDraft((draft) => ({ ...draft, modelId: event.target.value }))
                        }
                        disabled={!agentDraft.providerId}
                      >
                        <option value="">Default</option>
                        {providerModels.map((model) => (
                          <option key={model.id} value={model.modelId}>
                            {model.displayName ?? model.modelId}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeSession?.summary ? (
              <div className="mb-3 rounded-md border border-border bg-muted/30 p-3">
                <div className="mb-1 text-xs font-semibold">Rolling summary</div>
                <p className="text-xs leading-5 text-muted-foreground">{activeSession.summary}</p>
              </div>
            ) : null}

            {selectedAgent ? (
              <div className="mb-3 space-y-2 rounded-md border border-border p-3">
                <div className="text-xs font-semibold">Add long-term memory</div>
                <Input
                  className="h-8 text-xs"
                  value={memoryDraft.kind}
                  onChange={(event) =>
                    setMemoryDraft((draft) => ({ ...draft, kind: event.target.value }))
                  }
                  placeholder="kind: preference / fact / observation"
                />
                <Textarea
                  className="min-h-16 text-xs"
                  value={memoryDraft.content}
                  onChange={(event) =>
                    setMemoryDraft((draft) => ({ ...draft, content: event.target.value }))
                  }
                  placeholder="Memory content scoped to this agent..."
                />
                <Button
                  size="xs"
                  className="w-full"
                  onClick={saveMemory}
                  disabled={savingMemory || !memoryDraft.content.trim()}
                >
                  Save memory
                </Button>
              </div>
            ) : null}

            {memories.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-4 text-xs leading-5 text-muted-foreground">
                No stored memories match this session yet. New memory can be saved through the Agent
                memory API.
              </div>
            ) : (
              <div className="space-y-2">
                {memories.map((memory) => (
                  <div key={memory.id} className="rounded-md border border-border p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <Badge variant="secondary">{memory.kind}</Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {memory.scope}:{memory.importance}
                      </span>
                    </div>
                    <p className="text-xs leading-5">{memory.content}</p>
                  </div>
                ))}
              </div>
            )}
          </CardPanelBody>
        </CardPanel>
      </div>
    </div>
  )
}
