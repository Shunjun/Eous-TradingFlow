import { create } from 'zustand'

const STORAGE_KEY = 'eous.recentWorkflows.v1'
const MAX_RECENT_WORKFLOWS = 8

interface RecentWorkflowRef {
  id: string
  name: string
  updatedAt: string
}

interface RecentWorkflowState {
  recent: RecentWorkflowRef[]
  markRecent: (workflow: RecentWorkflowRef) => void
  removeRecent: (id: string) => void
  retainExisting: (ids: string[]) => void
}

function readRecent(): RecentWorkflowRef[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is RecentWorkflowRef =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as RecentWorkflowRef).id === 'string' &&
        typeof (item as RecentWorkflowRef).name === 'string',
    )
  } catch {
    return []
  }
}

function writeRecent(recent: RecentWorkflowRef[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(recent))
}

export const useRecentWorkflowsStore = create<RecentWorkflowState>((set) => ({
  recent: readRecent(),

  markRecent: (workflow) =>
    set((state) => {
      const nextWorkflow = {
        ...workflow,
        updatedAt: workflow.updatedAt || new Date().toISOString(),
      }
      const existingIndex = state.recent.findIndex((item) => item.id === workflow.id)
      const next =
        existingIndex >= 0
          ? state.recent.map((item, index) => (index === existingIndex ? nextWorkflow : item))
          : [nextWorkflow, ...state.recent].slice(0, MAX_RECENT_WORKFLOWS)
      writeRecent(next)
      return { recent: next }
    }),

  removeRecent: (id) =>
    set((state) => {
      const next = state.recent.filter((item) => item.id !== id)
      writeRecent(next)
      return { recent: next }
    }),

  retainExisting: (ids) =>
    set((state) => {
      const allowedIds = new Set(ids)
      const next = state.recent.filter((item) => allowedIds.has(item.id))
      if (next.length === state.recent.length) return state
      writeRecent(next)
      return { recent: next }
    }),
}))
