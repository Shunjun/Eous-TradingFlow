import type { Node } from '@xyflow/react'
import { toWorkflowNode } from './workflow-ops'
import type { WorkflowNodeData } from '../nodes/node-types'
import type { WorkflowSliceCreator, WorkflowUiSlice } from './types'

const createUiSlice: WorkflowSliceCreator<WorkflowUiSlice> = (set, get) => ({
  selectedNodeId: null,
  canvasMode: 'pan',
  logOpen: false,
  clipboardNode: null,

  setSelectedNodeId: (nodeId) => set({ selectedNodeId: nodeId }),
  setCanvasMode: (mode) => set({ canvasMode: mode }),
  toggleLogOpen: () => set((state) => ({ logOpen: !state.logOpen })),
  closeSettingsPanel: () => set({ selectedNodeId: null }),
  copyNode: (nodeId) => {
    const node = get().nodes.find((item) => item.id === nodeId)
    if (!node) return
    set({
      clipboardNode: {
        ...node,
        data: { ...(node.data ?? {}) },
        selected: false,
      } as Node<WorkflowNodeData>,
    })
  },
  cutNode: (nodeId) => {
    get().copyNode(nodeId)
    get().commitOps([{ type: 'node.delete', nodeId, force: true }], '删除节点')
  },
  pasteNode: (position) => {
    const clipboardNode = get().clipboardNode
    if (!clipboardNode) return
    const targetPosition = position ?? {
      x: clipboardNode.position.x + 32,
      y: clipboardNode.position.y + 32,
    }
    const nextNode = {
      ...clipboardNode,
      id: `${clipboardNode.type ?? 'node'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      position: targetPosition,
      data: { ...(clipboardNode.data ?? {}) },
      selected: false,
    }
    get().commitOps([{ type: 'node.add', node: toWorkflowNode(nextNode) }], '粘贴节点')
  },
})

export { createUiSlice }
