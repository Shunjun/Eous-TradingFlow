import { create } from 'zustand'
import type { Node, Edge } from '@xyflow/react'
import type { WorkflowEditOp } from '@eous/api-client'
import { applyWorkflowOpsToState, invertWorkflowOps } from './workflow-ops'

interface WorkflowHistoryEntry {
  id: string
  label: string
  ops: WorkflowEditOp[]
  inverseOps: WorkflowEditOp[]
  createdAt: number
}

interface WorkflowEditorState {
  nodes: Node[]
  edges: Edge[]
  activeWorkflowId: string | null
  workflowName: string
  isDirty: boolean
  lastModified: number
  past: WorkflowHistoryEntry[]
  future: WorkflowHistoryEntry[]
  pendingOps: WorkflowEditOp[]

  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  onNodesChange: (nodes: Node[]) => void
  onEdgesChange: (edges: Edge[]) => void
  addNode: (node: Node) => void
  removeNodes: (ids: string[]) => void
  commitOps: (ops: WorkflowEditOp[], label: string) => void
  undo: () => void
  redo: () => void
  clearHistory: () => void
  markSynced: () => void
  loadWorkflow: (id: string, name: string, nodes: Node[], edges: Edge[]) => void
  markDirty: () => void
  markClean: () => void
  setWorkflowName: (name: string) => void
  reset: () => void
}

export const useWorkflowStore = create<WorkflowEditorState>((set) => ({
  nodes: [],
  edges: [],
  activeWorkflowId: null,
  workflowName: '',
  isDirty: false,
  lastModified: 0,
  past: [],
  future: [],
  pendingOps: [],

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  onNodesChange: (nodes) => set({ nodes, isDirty: true, lastModified: Date.now() }),
  onEdgesChange: (edges) => set({ edges, isDirty: true, lastModified: Date.now() }),
  addNode: (node) =>
    set((state) => ({ nodes: [...state.nodes, node], isDirty: true, lastModified: Date.now() })),
  removeNodes: (ids) =>
    set((state) => {
      const idSet = new Set(ids)
      return {
        nodes: state.nodes.filter((n) => !idSet.has(n.id)),
        edges: state.edges.filter((e) => !idSet.has(e.source) && !idSet.has(e.target)),
        isDirty: true,
        lastModified: Date.now(),
      }
    }),
  commitOps: (ops, label) =>
    set((state) => {
      if (ops.length === 0) return state
      const inverseOps = invertWorkflowOps({ nodes: state.nodes, edges: state.edges }, ops)
      const next = applyWorkflowOpsToState({ nodes: state.nodes, edges: state.edges }, ops)
      return {
        nodes: next.nodes,
        edges: next.edges,
        past: [
          ...state.past,
          {
            id: `history-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            label,
            ops,
            inverseOps,
            createdAt: Date.now(),
          },
        ],
        future: [],
        pendingOps: [...state.pendingOps, ...ops],
        isDirty: true,
        lastModified: Date.now(),
      }
    }),
  undo: () =>
    set((state) => {
      const entry = state.past.at(-1)
      if (!entry) return state
      const next = applyWorkflowOpsToState(
        { nodes: state.nodes, edges: state.edges },
        entry.inverseOps,
      )
      return {
        nodes: next.nodes,
        edges: next.edges,
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
      const next = applyWorkflowOpsToState({ nodes: state.nodes, edges: state.edges }, entry.ops)
      return {
        nodes: next.nodes,
        edges: next.edges,
        past: [...state.past, entry],
        future: state.future.slice(1),
        pendingOps: [...state.pendingOps, ...entry.ops],
        isDirty: true,
        lastModified: Date.now(),
      }
    }),
  clearHistory: () => set({ past: [], future: [], pendingOps: [] }),
  markSynced: () => set({ pendingOps: [], isDirty: false }),
  loadWorkflow: (id, name, nodes, edges) =>
    set({
      activeWorkflowId: id,
      workflowName: name,
      nodes,
      edges,
      isDirty: false,
      lastModified: 0,
      past: [],
      future: [],
      pendingOps: [],
    }),
  markDirty: () => set({ isDirty: true, lastModified: Date.now() }),
  markClean: () => set({ isDirty: false }),
  setWorkflowName: (name) => set({ workflowName: name, isDirty: true, lastModified: Date.now() }),
  reset: () =>
    set({
      nodes: [],
      edges: [],
      activeWorkflowId: null,
      workflowName: '',
      isDirty: false,
      lastModified: 0,
      past: [],
      future: [],
      pendingOps: [],
    }),
}))

export type { WorkflowHistoryEntry }
