import type { Edge, Node } from '@xyflow/react'
import type { WorkflowEditOp, WorkflowEdge, WorkflowNode } from '@eous/api-client'

type WorkflowNodeState = Node<Record<string, unknown>>
type WorkflowEdgeState = Edge

interface WorkflowGraphState {
  nodes: WorkflowNodeState[]
  edges: WorkflowEdgeState[]
}

function toWorkflowNode(node: WorkflowNodeState): WorkflowNode {
  return {
    id: node.id,
    type: node.type ?? '',
    position: node.position,
    data: node.data ?? {},
    ...(node.draggable === false ? { meta: { locked: true } } : {}),
  }
}

function toWorkflowEdge(edge: WorkflowEdgeState): WorkflowEdge {
  return {
    id: edge.id,
    source: edge.source,
    sourceHandle: edge.sourceHandle ?? undefined,
    target: edge.target,
    targetHandle: edge.targetHandle ?? undefined,
  }
}

function fromWorkflowNode(node: WorkflowNode): WorkflowNodeState {
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    data: node.data,
    draggable: node.meta?.locked ? false : undefined,
  }
}

function fromWorkflowEdge(edge: WorkflowEdge): WorkflowEdgeState {
  return {
    id: edge.id,
    source: edge.source,
    sourceHandle: edge.sourceHandle,
    target: edge.target,
    targetHandle: edge.targetHandle,
  }
}

function applyWorkflowOpsToState(
  state: WorkflowGraphState,
  ops: WorkflowEditOp[],
): WorkflowGraphState {
  let nodes = state.nodes
  let edges = state.edges

  for (const op of ops) {
    switch (op.type) {
      case 'workflow.rename':
        break

      case 'node.add':
        nodes = [...nodes, fromWorkflowNode(op.node)]
        break

      case 'node.update':
        nodes = nodes.map((node) => {
          if (node.id !== op.nodeId) return node
          return {
            ...node,
            ...(op.position ? { position: op.position } : {}),
            ...(op.dataPatch ? { data: { ...(node.data ?? {}), ...op.dataPatch } } : {}),
            ...(op.metaPatch && 'locked' in op.metaPatch
              ? { draggable: op.metaPatch.locked ? false : undefined }
              : {}),
          }
        })
        break

      case 'node.delete':
        nodes = nodes.filter((node) => node.id !== op.nodeId)
        edges = edges.filter((edge) => edge.source !== op.nodeId && edge.target !== op.nodeId)
        break

      case 'edge.add':
        edges = [...edges, fromWorkflowEdge(op.edge)]
        break

      case 'edge.update':
        edges = edges.map((edge) => (edge.id === op.edgeId ? { ...edge, ...op.patch } : edge))
        break

      case 'edge.delete':
        edges = edges.filter((edge) => edge.id !== op.edgeId)
        break

      case 'node.insertBetween': {
        const edge = edges.find((item) => item.id === op.edgeId)
        if (!edge) break
        const sourceToNewEdge: WorkflowEdge = {
          id: op.sourceToNewEdge?.id ?? `${edge.source}-${op.node.id}`,
          source: edge.source,
          sourceHandle: edge.sourceHandle ?? undefined,
          target: op.node.id,
          targetHandle: op.sourceToNewEdge?.targetHandle,
          ...op.sourceToNewEdge,
        }
        const newToTargetEdge: WorkflowEdge = {
          id: op.newToTargetEdge?.id ?? `${op.node.id}-${edge.target}`,
          source: op.node.id,
          sourceHandle: op.newToTargetEdge?.sourceHandle,
          target: edge.target,
          targetHandle: edge.targetHandle ?? undefined,
          ...op.newToTargetEdge,
        }
        nodes = [...nodes, fromWorkflowNode(op.node)]
        edges = edges
          .filter((item) => item.id !== op.edgeId)
          .concat(fromWorkflowEdge(sourceToNewEdge), fromWorkflowEdge(newToTargetEdge))
        break
      }
    }
  }

  return { nodes, edges }
}

function invertWorkflowOps(state: WorkflowGraphState, ops: WorkflowEditOp[]): WorkflowEditOp[] {
  let cursor = state
  const inverse: WorkflowEditOp[] = []

  for (const op of ops) {
    switch (op.type) {
      case 'workflow.rename':
        break

      case 'node.add':
        inverse.unshift({ type: 'node.delete', nodeId: op.node.id, force: true })
        break

      case 'node.update': {
        const node = cursor.nodes.find((item) => item.id === op.nodeId)
        if (node) {
          const dataPatch: Record<string, unknown> = {}
          for (const key of Object.keys(op.dataPatch ?? {})) {
            dataPatch[key] = node.data?.[key]
          }
          inverse.unshift({
            type: 'node.update',
            nodeId: op.nodeId,
            ...(op.position ? { position: node.position } : {}),
            ...(op.dataPatch ? { dataPatch } : {}),
            ...(op.metaPatch && 'locked' in op.metaPatch
              ? { metaPatch: { locked: node.draggable === false } }
              : {}),
            force: true,
          })
        }
        break
      }

      case 'node.delete': {
        const node = cursor.nodes.find((item) => item.id === op.nodeId)
        const connectedEdges = cursor.edges.filter(
          (edge) => edge.source === op.nodeId || edge.target === op.nodeId,
        )
        if (node) {
          inverse.unshift(
            ...connectedEdges.map(
              (edge): WorkflowEditOp => ({ type: 'edge.add', edge: toWorkflowEdge(edge) }),
            ),
          )
          inverse.unshift({ type: 'node.add', node: toWorkflowNode(node) })
        }
        break
      }

      case 'edge.add':
        inverse.unshift({ type: 'edge.delete', edgeId: op.edge.id })
        break

      case 'edge.update': {
        const edge = cursor.edges.find((item) => item.id === op.edgeId)
        if (edge) {
          const patch: Partial<WorkflowEdge> = {}
          for (const key of Object.keys(op.patch) as Array<keyof WorkflowEdge>) {
            patch[key] = toWorkflowEdge(edge)[key] as never
          }
          inverse.unshift({ type: 'edge.update', edgeId: op.edgeId, patch })
        }
        break
      }

      case 'edge.delete': {
        const edge = cursor.edges.find((item) => item.id === op.edgeId)
        if (edge) inverse.unshift({ type: 'edge.add', edge: toWorkflowEdge(edge) })
        break
      }

      case 'node.insertBetween': {
        const edge = cursor.edges.find((item) => item.id === op.edgeId)
        if (edge) {
          inverse.unshift({ type: 'edge.add', edge: toWorkflowEdge(edge) })
          inverse.unshift({ type: 'node.delete', nodeId: op.node.id, force: true })
        }
        break
      }
    }

    cursor = applyWorkflowOpsToState(cursor, [op])
  }

  return inverse
}

export {
  applyWorkflowOpsToState,
  fromWorkflowEdge,
  fromWorkflowNode,
  invertWorkflowOps,
  toWorkflowEdge,
  toWorkflowNode,
}
export type { WorkflowGraphState, WorkflowNodeState, WorkflowEdgeState }
