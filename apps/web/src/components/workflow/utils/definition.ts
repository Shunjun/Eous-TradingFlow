import type { Edge, Node } from '@xyflow/react'
import { nodeRegistry } from '@eous/nodes'
import type {
  NodeType,
  WorkflowDefinition,
  WorkflowDefinitionDocument,
  WorkflowEditOp,
} from '@eous/api-client'
import { toWorkflowEdge, toWorkflowNode } from '../store/workflow-ops'

const VALID_NODE_TYPES = new Set<string>(Object.keys(nodeRegistry))

const NODE_DEFAULTS: Record<string, Record<string, unknown>> = Object.fromEntries(
  Object.entries(nodeRegistry).map(([type, entry]) => [
    type,
    extractNodeDefaults(entry.def.executeInput),
  ]),
)

const NODE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(nodeRegistry).map(([type, entry]) => [type, entry.def.meta.label]),
)

const NODE_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(nodeRegistry).map(([type, entry]) => [type, entry.def.meta.color]),
)

function extractNodeDefaults(
  input: Record<string, { default?: unknown }>,
): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (const [key, def] of Object.entries(input)) {
    if (def.default !== undefined) {
      data[key] = def.default
    }
  }
  return data
}

function isWorkflowNodeType(value: string): value is NodeType {
  return VALID_NODE_TYPES.has(value)
}

function toLocalWorkflowNodes(workflow: WorkflowDefinition): Node[] {
  return workflow.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position,
    data: node.data,
    draggable: node.meta?.locked ? false : undefined,
  }))
}

function toLocalWorkflowEdges(workflow: WorkflowDefinition): Edge[] {
  return workflow.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    sourceHandle: edge.sourceHandle,
    target: edge.target,
    targetHandle: edge.targetHandle,
  }))
}

function buildWorkflowDocument(nodes: Node[], edges: Edge[]): WorkflowDefinitionDocument {
  return {
    schemaVersion: 1,
    nodes: nodes.flatMap((node) => {
      if (!node.type || !isWorkflowNodeType(node.type)) return []
      return [toWorkflowNode(node)]
    }),
    edges: edges.map(toWorkflowEdge),
  }
}

function workflowContentOps(ops: WorkflowEditOp[]): WorkflowEditOp[] {
  return ops.filter((op) => op.type !== 'workflow.rename')
}

function createDefaultWorkflowNode(
  nodeType: string,
  options: { id?: string; position?: { x: number; y: number } } = {},
): Node {
  const defaults = NODE_DEFAULTS[nodeType]
  return {
    id: options.id ?? `${nodeType}-${Date.now()}`,
    type: nodeType,
    position: options.position ?? { x: 250 + Math.random() * 100, y: 150 + Math.random() * 100 },
    data: {
      status: 'idle' as const,
      label: NODE_LABELS[nodeType] ?? nodeType,
      color: NODE_COLORS[nodeType],
      ...defaults,
    },
  }
}

function createDefaultWorkflowNodes(): Node[] {
  return [
    createDefaultWorkflowNode('trigger.start', {
      id: 'start',
      position: { x: 120, y: 160 },
    }),
  ]
}

export {
  buildWorkflowDocument,
  createDefaultWorkflowNode,
  createDefaultWorkflowNodes,
  isWorkflowNodeType,
  toLocalWorkflowEdges,
  toLocalWorkflowNodes,
  workflowContentOps,
}
