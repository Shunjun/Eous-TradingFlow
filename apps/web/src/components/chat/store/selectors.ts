import type { ChatState } from './types'

export function selectSelectedAgent(state: ChatState) {
  return state.agents.find((agent) => agent.id === state.selectedAgentId) ?? state.agents[0] ?? null
}

export function selectActiveSession(state: ChatState) {
  return state.sessions.find((session) => session.id === state.activeSessionId) ?? null
}

export function selectActiveAgent(state: ChatState) {
  const activeSession = selectActiveSession(state)
  return (
    state.agents.find((agent) => agent.id === activeSession?.agentId) ?? selectSelectedAgent(state)
  )
}

export function selectHasIncompleteModelOverride(state: ChatState) {
  return Boolean(state.selectedProviderId && !state.selectedModelId)
}
