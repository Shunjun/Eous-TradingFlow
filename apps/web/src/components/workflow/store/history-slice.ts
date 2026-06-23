import { applyWorkflowOpsToState, invertWorkflowOps } from './workflow-ops'
import type { WorkflowHistorySlice, WorkflowSliceCreator } from './types'
import { createHistoryId, workflowContentOps } from './helpers'

const createHistorySlice: WorkflowSliceCreator<WorkflowHistorySlice> = (set) => ({
  past: [],
  future: [],
  pendingOps: [],

  commitOps: (ops, label) =>
    set((state) => {
      const contentOps = workflowContentOps(ops)
      if (contentOps.length === 0) return state
      const inverseOps = invertWorkflowOps(
        { nodes: state.nodes, edges: state.edges, workflowName: state.workflowName },
        contentOps,
      )
      const next = applyWorkflowOpsToState(
        { nodes: state.nodes, edges: state.edges, workflowName: state.workflowName },
        contentOps,
      )
      return {
        nodes: next.nodes,
        edges: next.edges,
        workflowName: next.workflowName ?? state.workflowName,
        past: [
          ...state.past,
          {
            id: createHistoryId(),
            label,
            ops: contentOps,
            inverseOps,
            createdAt: Date.now(),
          },
        ],
        future: [],
        pendingOps: [...state.pendingOps, ...contentOps],
        isDirty: true,
        lastModified: Date.now(),
      }
    }),
  undo: () =>
    set((state) => {
      const entry = state.past.at(-1)
      if (!entry) return state
      const next = applyWorkflowOpsToState(
        { nodes: state.nodes, edges: state.edges, workflowName: state.workflowName },
        entry.inverseOps,
      )
      return {
        nodes: next.nodes,
        edges: next.edges,
        workflowName: next.workflowName ?? state.workflowName,
        past: state.past.slice(0, -1),
        future: [entry, ...state.future],
        pendingOps: [...state.pendingOps, ...entry.inverseOps],
        isDirty: true,
        lastModified: Date.now(),
      }
    }),
  redo: () =>
    set((state) => {
      const entry = state.future[0]
      if (!entry) return state
      const next = applyWorkflowOpsToState(
        { nodes: state.nodes, edges: state.edges, workflowName: state.workflowName },
        entry.ops,
      )
      return {
        nodes: next.nodes,
        edges: next.edges,
        workflowName: next.workflowName ?? state.workflowName,
        past: [...state.past, entry],
        future: state.future.slice(1),
        pendingOps: [...state.pendingOps, ...entry.ops],
        isDirty: true,
        lastModified: Date.now(),
      }
    }),
  clearHistory: () => set({ past: [], future: [], pendingOps: [] }),
  markSynced: () => set({ pendingOps: [], isDirty: false }),
})

export { createHistorySlice }
