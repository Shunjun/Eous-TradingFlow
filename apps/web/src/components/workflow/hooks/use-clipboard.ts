import { useCallback, useState } from 'react'
import type { Node } from '@xyflow/react'
import type { WorkflowEditOp } from '@eous/api-client'
import { toWorkflowNode } from '../store/workflow-ops'
import type { WorkflowNodeData } from '../canvas/node-types'

interface UseWorkflowClipboardParams {
  getNodes: () => Node[]
  commitOps: (ops: WorkflowEditOp[], label: string) => void
  deleteNode: (nodeId: string) => void
}

function useWorkflowClipboard({ getNodes, commitOps, deleteNode }: UseWorkflowClipboardParams) {
  const [clipboardNode, setClipboardNode] = useState<Node<WorkflowNodeData> | null>(null)

  const copyNode = useCallback(
    (nodeId: string) => {
      const node = getNodes().find((item) => item.id === nodeId)
      if (!node) return
      setClipboardNode({
        ...node,
        data: { ...(node.data ?? {}) },
        selected: false,
      } as Node<WorkflowNodeData>)
    },
    [getNodes],
  )

  const cutNode = useCallback(
    (nodeId: string) => {
      copyNode(nodeId)
      deleteNode(nodeId)
    },
    [copyNode, deleteNode],
  )

  const pasteNode = useCallback(
    (position?: { x: number; y: number }) => {
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
      commitOps([{ type: 'node.add', node: toWorkflowNode(nextNode) }], '粘贴节点')
    },
    [clipboardNode, commitOps],
  )

  return {
    canPaste: clipboardNode !== null,
    copyNode,
    cutNode,
    pasteNode,
  }
}

export { useWorkflowClipboard }
