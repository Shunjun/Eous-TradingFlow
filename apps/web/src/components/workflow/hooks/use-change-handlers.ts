import { useCallback } from 'react'
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react'
import type { WorkflowEditOp } from '@eous/api-client'
import type { WorkflowStore } from '../store/workflow-store'
import { toWorkflowEdge, toWorkflowNode } from '../store/workflow-ops'

function hasPersistableNodeChange(changes: NodeChange[]): boolean {
  return changes.some(
    (change) =>
      change.type === 'position' ||
      change.type === 'add' ||
      change.type === 'remove' ||
      change.type === 'replace',
  )
}

function isDraggingPositionChange(change: NodeChange): boolean {
  return change.type === 'position' && change.dragging === true
}

function hasPersistableEdgeChange(changes: EdgeChange[]): boolean {
  return changes.some(
    (change) => change.type === 'add' || change.type === 'remove' || change.type === 'replace',
  )
}

interface UseWorkflowChangeHandlersParams {
  workflowStore: WorkflowStore
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  onNodesChange: (nodes: Node[]) => void
  onEdgesChange: (edges: Edge[]) => void
  commitOps: (ops: WorkflowEditOp[], label: string) => void
  deleteNodes: (nodeIds: string[]) => void
  deleteEdges: (edgeIds: string[]) => void
}

function useWorkflowChangeHandlers({
  workflowStore,
  setNodes,
  setEdges,
  onNodesChange,
  onEdgesChange,
  commitOps,
  deleteNodes,
  deleteEdges,
}: UseWorkflowChangeHandlersParams) {
  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const currentNodes = workflowStore.getState().nodes
      const nextNodes = applyNodeChanges(changes, currentNodes)
      if (changes.some(isDraggingPositionChange)) {
        setNodes(nextNodes)
        return
      }

      if (hasPersistableNodeChange(changes)) {
        const ops: WorkflowEditOp[] = []
        for (const change of changes) {
          if (change.type === 'position' && change.position) {
            ops.push({ type: 'node.update', nodeId: change.id, position: change.position })
          } else if (change.type === 'remove') {
            ops.push({ type: 'node.delete', nodeId: change.id, force: true })
          } else if (change.type === 'add') {
            ops.push({ type: 'node.add', node: toWorkflowNode(change.item) })
          } else if (change.type === 'replace') {
            ops.push({ type: 'node.delete', nodeId: change.id, force: true })
            ops.push({ type: 'node.add', node: toWorkflowNode(change.item) })
          }
        }
        if (ops.length > 0) {
          commitOps(ops, '更新节点')
        } else {
          onNodesChange(nextNodes)
        }
      } else {
        setNodes(nextNodes)
      }
    },
    [commitOps, onNodesChange, setNodes, workflowStore],
  )

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      const currentEdges = workflowStore.getState().edges
      const nextEdges = applyEdgeChanges(changes, currentEdges)
      if (hasPersistableEdgeChange(changes)) {
        const ops: WorkflowEditOp[] = []
        for (const change of changes) {
          if (change.type === 'remove') {
            ops.push({ type: 'edge.delete', edgeId: change.id })
          } else if (change.type === 'add') {
            ops.push({ type: 'edge.add', edge: toWorkflowEdge(change.item) })
          } else if (change.type === 'replace') {
            ops.push({ type: 'edge.delete', edgeId: change.id })
            ops.push({ type: 'edge.add', edge: toWorkflowEdge(change.item) })
          }
        }
        if (ops.length > 0) {
          commitOps(ops, '更新连线')
        } else {
          onEdgesChange(nextEdges)
        }
      } else {
        setEdges(nextEdges)
      }
    },
    [commitOps, onEdgesChange, setEdges, workflowStore],
  )

  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const edge = {
        id: `${connection.source}-${connection.target}-${Date.now()}`,
        source: connection.source,
        sourceHandle: connection.sourceHandle ?? undefined,
        target: connection.target,
        targetHandle: connection.targetHandle ?? undefined,
      }
      commitOps([{ type: 'edge.add', edge }], '连接节点')
    },
    [commitOps],
  )

  const handleDelete = useCallback(
    (params: { nodes: Node[]; edges: Edge[] }) => {
      if (params.nodes.length > 0) {
        deleteNodes(params.nodes.map((node) => node.id))
      } else if (params.edges.length > 0) {
        deleteEdges(params.edges.map((edge) => edge.id))
      }
    },
    [deleteEdges, deleteNodes],
  )

  return {
    handleNodesChange,
    handleEdgesChange,
    handleConnect,
    handleDelete,
  }
}

export { useWorkflowChangeHandlers }
