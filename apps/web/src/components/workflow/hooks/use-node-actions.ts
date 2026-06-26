import { useCallback } from 'react'
import type { Edge, Node } from '@xyflow/react'
import type { WorkflowEditOp } from '@eous/api-client'
import { api } from '../../../lib/api'
import type { WorkflowStore } from '../store/workflow-store'
import { toWorkflowNode } from '../store/workflow-ops'
import { createWorkflowNode } from '../nodes/node-types'
import { WORKFLOW_FIT_VIEW_OPTIONS } from '../canvas/viewport'
import { layoutNodes } from '../utils'

interface UseWorkflowNodeActionsParams {
  workflowStore: WorkflowStore
  commitOps: (ops: WorkflowEditOp[], label: string) => void
  fitView: (options: typeof WORKFLOW_FIT_VIEW_OPTIONS & { duration?: number }) => Promise<boolean>
}

function useWorkflowNodeActions({
  workflowStore,
  commitOps,
  fitView,
}: UseWorkflowNodeActionsParams) {
  const runNode = useCallback(
    (nodeId: string) => {
      const workflowId = workflowStore.getState().activeWorkflowId
      if (!workflowId || workflowId === 'new') return
      void api.runWorkflowNode(workflowId, nodeId)
    },
    [workflowStore],
  )

  const duplicateNode = useCallback(
    (nodeId: string) => {
      const currentNodes = workflowStore.getState().nodes
      const sourceNode = currentNodes.find((node) => node.id === nodeId)
      if (!sourceNode) return
      if (sourceNode.type === 'trigger.start') return

      const nextNode = {
        ...sourceNode,
        id: `${sourceNode.type ?? 'node'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        selected: false,
        position: {
          x: sourceNode.position.x + 32,
          y: sourceNode.position.y + 32,
        },
        data: { ...(sourceNode.data ?? {}) },
      }
      commitOps([{ type: 'node.add', node: toWorkflowNode(nextNode) }], '复制节点')
    },
    [commitOps, workflowStore],
  )

  const deleteNode = useCallback(
    (nodeId: string) => {
      commitOps([{ type: 'node.delete', nodeId, force: true }], '删除节点')
    },
    [commitOps],
  )

  const deleteNodes = useCallback(
    (nodeIds: string[]) => {
      commitOps(
        nodeIds.map((nodeId): WorkflowEditOp => ({ type: 'node.delete', nodeId, force: true })),
        '删除节点',
      )
    },
    [commitOps],
  )

  const deleteEdges = useCallback(
    (edgeIds: string[]) => {
      commitOps(
        edgeIds.map((edgeId): WorkflowEditOp => ({ type: 'edge.delete', edgeId })),
        '删除连线',
      )
    },
    [commitOps],
  )

  const toggleLockNode = useCallback(
    (nodeId: string) => {
      const node = workflowStore.getState().nodes.find((item) => item.id === nodeId)
      if (!node) return
      commitOps(
        [{ type: 'node.update', nodeId, metaPatch: { locked: node.draggable !== false } }],
        node.draggable === false ? '解锁节点' : '锁定节点',
      )
    },
    [commitOps, workflowStore],
  )

  const addConnectedNode = useCallback(
    ({
      sourceNodeId,
      sourceHandle,
      nodeType,
    }: {
      sourceNodeId: string
      sourceHandle: string
      nodeType: string
    }) => {
      const currentNodes = workflowStore.getState().nodes
      const sourceNode = currentNodes.find((node) => node.id === sourceNodeId)
      if (!sourceNode) return

      const nextNode = createWorkflowNode(nodeType, {
        x: sourceNode.position.x + 280,
        y: sourceNode.position.y,
      })

      const edge = {
        id: `${sourceNodeId}-${nextNode.id}`,
        source: sourceNodeId,
        sourceHandle,
        target: nextNode.id,
        targetHandle: 'target',
      }
      commitOps(
        [
          { type: 'node.add', node: toWorkflowNode(nextNode) },
          { type: 'edge.add', edge },
        ],
        '添加并连接节点',
      )
    },
    [commitOps, workflowStore],
  )

  const autoLayout = useCallback(() => {
    const current = workflowStore.getState()
    const nextNodes = layoutNodes(current.nodes as Node[], current.edges as Edge[])
    const ops = nextNodes.flatMap((node): WorkflowEditOp[] => {
      const currentNode = current.nodes.find((item) => item.id === node.id)
      if (!currentNode) return []
      if (
        currentNode.position.x === node.position.x &&
        currentNode.position.y === node.position.y
      ) {
        return []
      }
      return [{ type: 'node.update', nodeId: node.id, position: node.position }]
    })
    if (ops.length === 0) return
    commitOps(ops, '自动布局')
    window.requestAnimationFrame(() => {
      void fitView({ ...WORKFLOW_FIT_VIEW_OPTIONS, duration: 240 })
    })
  }, [commitOps, fitView, workflowStore])

  return {
    runNode,
    duplicateNode,
    deleteNode,
    deleteNodes,
    deleteEdges,
    toggleLockNode,
    addConnectedNode,
    autoLayout,
  }
}

export { useWorkflowNodeActions }
