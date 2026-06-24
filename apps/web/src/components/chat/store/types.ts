import type {
  AgentMessage,
  AgentSessionSummary,
  AgentSummary,
  Provider,
  ProviderModel,
} from '@eous/api-client'

type ValueUpdater<T> = T | ((current: T) => T)

interface ChatState {
  agents: AgentSummary[]
  sessions: AgentSessionSummary[]
  providers: Provider[]
  models: ProviderModel[]
  selectedAgentId: string | null
  selectedProviderId: string
  selectedModelId: string
  activeSessionId: string | null
  messages: AgentMessage[]
  input: string
  loading: boolean
  error: string | null
  sessionListOpen: boolean
  viewOpen: boolean
  isStreaming: boolean
  sendMessage: () => Promise<void>

  setError: (error: string | null) => void
  setInput: (input: string) => void
  setLoading: (loading: boolean) => void
  setModels: (models: ProviderModel[]) => void
  setMessages: (messages: ValueUpdater<AgentMessage[]>) => void
  setSessions: (sessions: ValueUpdater<AgentSessionSummary[]>) => void
  setActiveSessionId: (sessionId: string | null) => void
  setSelectedModelId: (modelId: string) => void
  setSessionListOpen: (open: ValueUpdater<boolean>) => void
  setViewOpen: (open: ValueUpdater<boolean>) => void
  setIsStreaming: (isStreaming: boolean) => void
  setSendMessage: (sendMessage: () => Promise<void>) => void
  loadShellSuccess: (
    agents: AgentSummary[],
    sessions: AgentSessionSummary[],
    providers: Provider[],
  ) => void
  selectAgent: (agentId: string) => void
  selectProvider: (providerId: string) => void
  startNewConversation: () => void
}

export type { ChatState, ValueUpdater }
