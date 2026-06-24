import { createContext, useContext, useRef, type ReactNode } from 'react'
import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { ChatState, ValueUpdater } from './types'

type ChatStore = StoreApi<ChatState>

function resolveUpdater<T>(current: T, value: ValueUpdater<T>): T {
  return typeof value === 'function' ? (value as (current: T) => T)(current) : value
}

function createChatStore(): ChatStore {
  return createStore<ChatState>((set, get) => ({
    agents: [],
    sessions: [],
    providers: [],
    models: [],
    selectedAgentId: null,
    selectedProviderId: '',
    selectedModelId: '',
    activeSessionId: null,
    messages: [],
    input: '',
    loading: true,
    error: null,
    sessionListOpen: true,
    viewOpen: false,
    isStreaming: false,
    sendMessage: async () => {},

    setError: (error) => set({ error }),
    setInput: (input) => set({ input }),
    setLoading: (loading) => set({ loading }),
    setModels: (models) => set({ models }),
    setMessages: (messages) =>
      set((state) => ({ messages: resolveUpdater(state.messages, messages) })),
    setSessions: (sessions) =>
      set((state) => ({ sessions: resolveUpdater(state.sessions, sessions) })),
    setActiveSessionId: (activeSessionId) => set({ activeSessionId }),
    setSelectedModelId: (selectedModelId) => set({ selectedModelId }),
    setSessionListOpen: (open) =>
      set((state) => ({ sessionListOpen: resolveUpdater(state.sessionListOpen, open) })),
    setViewOpen: (open) => set((state) => ({ viewOpen: resolveUpdater(state.viewOpen, open) })),
    setIsStreaming: (isStreaming) => set({ isStreaming }),
    setSendMessage: (sendMessage) => set({ sendMessage }),
    loadShellSuccess: (agents, sessions, providers) => {
      const firstAgent = agents[0] ?? null
      set((state) => ({
        agents,
        sessions,
        providers,
        selectedAgentId: state.selectedAgentId ?? firstAgent?.id ?? null,
        selectedProviderId: firstAgent?.providerId ?? '',
        selectedModelId: firstAgent?.modelId ?? '',
        activeSessionId: null,
        messages: [],
      }))
    },
    selectAgent: (agentId) => {
      const agent = get().agents.find((item) => item.id === agentId) ?? null
      set({
        selectedAgentId: agentId || null,
        selectedProviderId: agent?.providerId ?? '',
        selectedModelId: agent?.modelId ?? '',
      })
    },
    selectProvider: (selectedProviderId) => set({ selectedProviderId, selectedModelId: '' }),
    startNewConversation: () => set({ activeSessionId: null, messages: [], error: null }),
  }))
}

const ChatStoreContext = createContext<ChatStore | null>(null)

function ChatStoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<ChatStore | null>(null)
  if (!storeRef.current) storeRef.current = createChatStore()

  return <ChatStoreContext.Provider value={storeRef.current}>{children}</ChatStoreContext.Provider>
}

function useChatStore<T>(selector: (state: ChatState) => T): T {
  const store = useContext(ChatStoreContext)
  if (!store) throw new Error('useChatStore must be used within ChatStoreProvider')
  return useStore(store, selector)
}

function useChatStoreApi(): ChatStore {
  const store = useContext(ChatStoreContext)
  if (!store) throw new Error('useChatStoreApi must be used within ChatStoreProvider')
  return store
}

export { ChatStoreProvider, createChatStore, useChatStore, useChatStoreApi }
export type { ChatState, ChatStore }
