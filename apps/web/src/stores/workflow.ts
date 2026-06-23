import { create } from 'zustand'
import type { Node, Edge } from '@xyflow/react'

interface WorkflowEditorState {
  nodes: Node[]
  edges: Edge[]
  activeWorkflowId: string | null
  workflowName: string
  isDirty: boolean
  lastModified: number

  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  onNodesChange: (nodes: Node[]) => void
  onEdgesChange: (edges: Edge[]) => void
  addNode: (node: Node) => void
  removeNodes: (ids: string[]) => void
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
  loadWorkflow: (id, name, nodes, edges) =>
    set({
      activeWorkflowId: id,
      workflowName: name,
      nodes,
      edges,
      isDirty: false,
      lastModified: 0,
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
    }),
}))
