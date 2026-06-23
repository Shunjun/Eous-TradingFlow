import { createContext, useContext, useRef, type ReactNode } from 'react'
import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { Edge, Node } from '@xyflow/react'
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
  loadDraft: (
    id: string,
    name: string,
    nodes: Node[],
    edges: Edge[],
    pendingOps: WorkflowEditOp[],
  ) => void
  markDirty: () => void
  markClean: () => void
  setWorkflowName: (name: string) => void
  reset: () => void
}

type WorkflowStore = StoreApi<WorkflowEditorState>

function workflowContentOps(ops: WorkflowEditOp[]): WorkflowEditOp[] {
  return ops.filter((op) => op.type !== 'workflow.rename')
}

function createWorkflowStore(): WorkflowStore {
  return createStore<WorkflowEditorState>((set) => ({
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
              id: `history-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
    loadDraft: (id, name, nodes, edges, pendingOps) =>
      set({
        activeWorkflowId: id,
        workflowName: name,
        nodes,
        edges,
        isDirty: workflowContentOps(pendingOps).length > 0,
        lastModified: 0,
        past: [],
        future: [],
        pendingOps: workflowContentOps(pendingOps),
      }),
    markDirty: () => set({ isDirty: true, lastModified: Date.now() }),
    markClean: () => set({ isDirty: false }),
    setWorkflowName: (name) => set({ workflowName: name }),
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
}

const WorkflowStoreContext = createContext<WorkflowStore | null>(null)

function WorkflowStoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<WorkflowStore | null>(null)
  if (!storeRef.current) storeRef.current = createWorkflowStore()

  return (
    <WorkflowStoreContext.Provider value={storeRef.current}>
      {children}
    </WorkflowStoreContext.Provider>
  )
}

function useWorkflowStore<T>(selector: (state: WorkflowEditorState) => T): T {
  const store = useContext(WorkflowStoreContext)
  if (!store) throw new Error('useWorkflowStore must be used within WorkflowStoreProvider')
  return useStore(store, selector)
}

function useWorkflowStoreApi(): WorkflowStore {
  const store = useContext(WorkflowStoreContext)
  if (!store) throw new Error('useWorkflowStoreApi must be used within WorkflowStoreProvider')
  return store
}

export { WorkflowStoreProvider, createWorkflowStore, useWorkflowStore, useWorkflowStoreApi }
export type { WorkflowEditorState, WorkflowHistoryEntry, WorkflowStore }
