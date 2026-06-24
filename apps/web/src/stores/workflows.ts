import { create } from 'zustand'
import type { WorkflowDefinition } from '@eous/api-client'
import { api } from '../lib/api'
import { buildWorkflowDocument, createDefaultWorkflowNodes } from '../components/workflow/utils'

interface WorkflowListState {
  workflows: WorkflowDefinition[]
  loading: boolean
  loaded: boolean
  error: string | null
  loadWorkflows: (options?: { force?: boolean }) => Promise<void>
  refreshWorkflows: () => Promise<void>
  createWorkflow: (name: string, definition?: string) => Promise<WorkflowDefinition>
  deleteWorkflow: (id: string) => Promise<void>
  upsertWorkflow: (workflow: WorkflowDefinition) => void
  updateWorkflow: (id: string, patch: Partial<WorkflowDefinition>) => void
  removeWorkflow: (id: string) => void
}

let loadPromise: Promise<void> | null = null

function createDefaultWorkflowDefinition(): string {
  return JSON.stringify(buildWorkflowDocument(createDefaultWorkflowNodes(), []))
}

function sortWorkflows(workflows: WorkflowDefinition[]): WorkflowDefinition[] {
  return [...workflows].sort((a, b) => {
    const byUpdatedAt = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    if (byUpdatedAt !== 0) return byUpdatedAt
    return a.name.localeCompare(b.name)
  })
}

export const useWorkflowListStore = create<WorkflowListState>((set, get) => ({
  workflows: [],
  loading: false,
  loaded: false,
  error: null,

  loadWorkflows: async (options) => {
    const force = options?.force ?? false
    const state = get()
    if (!force && state.loaded) return
    if (loadPromise) return loadPromise

    set({ loading: true, error: null })
    loadPromise = api
      .listWorkflows()
      .then((workflows) => {
        set({
          workflows: sortWorkflows(workflows),
          loading: false,
          loaded: true,
          error: null,
        })
      })
      .catch((err) => {
        set({
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load workflows',
        })
      })
      .finally(() => {
        loadPromise = null
      })

    return loadPromise
  },

  refreshWorkflows: async () => {
    await get().loadWorkflows({ force: true })
  },

  createWorkflow: async (name, definition = createDefaultWorkflowDefinition()) => {
    const result = await api.createWorkflow({ name, definition })
    get().upsertWorkflow(result.workflow)
    return result.workflow
  },

  deleteWorkflow: async (id) => {
    await api.deleteWorkflow(id)
    get().removeWorkflow(id)
  },

  upsertWorkflow: (workflow) =>
    set((state) => {
      const exists = state.workflows.some((item) => item.id === workflow.id)
      const workflows = exists
        ? state.workflows.map((item) => (item.id === workflow.id ? workflow : item))
        : [workflow, ...state.workflows]

      return {
        workflows: sortWorkflows(workflows),
        loaded: true,
      }
    }),

  updateWorkflow: (id, patch) =>
    set((state) => ({
      workflows: sortWorkflows(
        state.workflows.map((workflow) =>
          workflow.id === id ? { ...workflow, ...patch } : workflow,
        ),
      ),
    })),

  removeWorkflow: (id) =>
    set((state) => ({
      workflows: state.workflows.filter((workflow) => workflow.id !== id),
    })),
}))
