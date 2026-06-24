import type { WorkflowDocumentSlice, WorkflowSliceCreator } from './types'
import { workflowContentOps } from './helpers'
import { createDefaultWorkflowNode, createDefaultWorkflowNodes } from '../utils'
import { toWorkflowNode } from './workflow-ops'

const createDocumentSlice: WorkflowSliceCreator<WorkflowDocumentSlice> = (set, get) => ({
  nodes: createDefaultWorkflowNodes(),
  edges: [],
  activeWorkflowId: null,
  workflowName: '',

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  onNodesChange: (nodes) => set({ nodes, isDirty: true, lastModified: Date.now() }),
  onEdgesChange: (edges) => set({ edges, isDirty: true, lastModified: Date.now() }),
  addNode: (node) =>
    set((state) => ({ nodes: [...state.nodes, node], isDirty: true, lastModified: Date.now() })),
  addDefaultNode: (nodeType) => {
    const node = createDefaultWorkflowNode(nodeType)
    get().commitOps([{ type: 'node.add', node: toWorkflowNode(node) }], '添加节点')
  },
  removeNodes: (ids) =>
    set((state) => {
      const idSet = new Set(ids)
      return {
        nodes: state.nodes.filter((node) => !idSet.has(node.id)),
        edges: state.edges.filter((edge) => !idSet.has(edge.source) && !idSet.has(edge.target)),
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
      past: [],
      future: [],
      pendingOps: [],
      selectedNodeId: null,
      clipboardNode: null,
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
      selectedNodeId: null,
      clipboardNode: null,
    }),
  setWorkflowName: (name) => set({ workflowName: name }),
})

export { createDocumentSlice }
