import type { Edge, Node } from '@xyflow/react'
import type { StateCreator, StoreApi } from 'zustand/vanilla'
import type { WorkflowEditOp } from '@eous/api-client'
import type { CanvasInteractionMode } from '../canvas'
import type { WorkflowNodeData } from '../nodes/node-types'

interface WorkflowHistoryEntry {
  id: string
  label: string
  ops: WorkflowEditOp[]
  inverseOps: WorkflowEditOp[]
  createdAt: number
}

interface WorkflowDocumentSlice {
  nodes: Node[]
  edges: Edge[]
  activeWorkflowId: string | null
  workflowName: string

  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  onNodesChange: (nodes: Node[]) => void
  onEdgesChange: (edges: Edge[]) => void
  addNode: (node: Node) => void
  addDefaultNode: (nodeType: string) => void
  removeNodes: (ids: string[]) => void
  loadWorkflow: (id: string, name: string, nodes: Node[], edges: Edge[]) => void
  loadDraft: (
    id: string,
    name: string,
    nodes: Node[],
    edges: Edge[],
    pendingOps: WorkflowEditOp[],
  ) => void
  setWorkflowName: (name: string) => void
}

interface WorkflowHistorySlice {
  past: WorkflowHistoryEntry[]
  future: WorkflowHistoryEntry[]
  pendingOps: WorkflowEditOp[]

  commitOps: (ops: WorkflowEditOp[], label: string) => void
  setHistoryEntries: (entries: WorkflowHistoryEntry[]) => void
  undo: () => void
  redo: () => void
  clearHistory: () => void
  markSynced: () => void
}

interface WorkflowStatusSlice {
  isDirty: boolean
  lastModified: number

  markDirty: () => void
  markClean: () => void
}

interface WorkflowUiSlice {
  selectedNodeId: string | null
  canvasMode: CanvasInteractionMode
  logOpen: boolean
  clipboardNode: Node<WorkflowNodeData> | null

  setSelectedNodeId: (nodeId: string | null) => void
  setCanvasMode: (mode: CanvasInteractionMode) => void
  toggleLogOpen: () => void
  closeSettingsPanel: () => void
  copyNode: (nodeId: string) => void
  cutNode: (nodeId: string) => void
  pasteNode: (position?: { x: number; y: number }) => void
}

type WorkflowEditorState = WorkflowDocumentSlice &
  WorkflowHistorySlice &
  WorkflowStatusSlice &
  WorkflowUiSlice & {
    reset: () => void
  }

type WorkflowStore = StoreApi<WorkflowEditorState>
type WorkflowSliceCreator<T> = StateCreator<WorkflowEditorState, [], [], T>

export type {
  WorkflowDocumentSlice,
  WorkflowEditorState,
  WorkflowHistoryEntry,
  WorkflowHistorySlice,
  WorkflowSliceCreator,
  WorkflowStatusSlice,
  WorkflowStore,
  WorkflowUiSlice,
}
