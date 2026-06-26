import type {
  ApplyWorkflowOpsRequest,
  WorkflowDefinitionDocument,
  WorkflowEditOp,
  WorkflowEdge,
  WorkflowNode,
} from '@eous/api-client'
import { nodeRegistry } from '@eous/nodes/server'
import type { ParamDef } from '@eous/nodes/types'
import { AppError } from '../lib/app-error.js'
import * as workflowRepo from '../repositories/workflow.repo.js'

interface ApplyWorkflowOpsResult {
  workflow: Awaited<ReturnType<typeof workflowRepo.update>>
  appliedOps: number
  warnings: string[]
}

function extractDefaults(input: Record<string, ParamDef>): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (const [key, def] of Object.entries(input)) {
    if (def.default !== undefined) data[key] = def.default
  }
  return data
}

function parseDefinition(raw: string): WorkflowDefinitionDocument {
  try {
    const parsed = JSON.parse(raw) as Partial<WorkflowDefinitionDocument>
    return {
      schemaVersion: 1,
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed.edges) ? parsed.edges : [],
      ...(parsed.viewport ? { viewport: parsed.viewport } : {}),
    }
  } catch {
    return { schemaVersion: 1, nodes: [], edges: [] }
  }
}

function serializeDefinition(definition: WorkflowDefinitionDocument): string {
  return JSON.stringify(definition)
}

function ensureWorkflowOwner(
  workflow: Awaited<ReturnType<typeof workflowRepo.findById>>,
  userId: string,
) {
  if (!workflow || workflow.userId !== userId) {
    throw new AppError('Workflow not found', 404)
  }
  return workflow
}

function ensureNodeType(type: string) {
  const entry = nodeRegistry[type]
  if (!entry) throw new AppError(`Unknown node type: ${type}`, 400)
  return entry
}

function normalizeNode(node: WorkflowNode, warnings: string[]): WorkflowNode {
  const entry = ensureNodeType(node.type)
  const label = entry.def.meta.label
  const color = entry.def.meta.color

  return {
    ...node,
    position: node.position ?? { x: 0, y: 0 },
    data: {
      status: 'idle',
      label,
      color,
      ...extractDefaults(entry.def.executeInput),
      ...(node.data ?? {}),
    },
    meta: node.meta,
  }
}

function assertUniqueNodeId(definition: WorkflowDefinitionDocument, nodeId: string) {
  if (definition.nodes.some((node) => node.id === nodeId)) {
    throw new AppError(`Duplicate node id: ${nodeId}`, 400)
  }
}

function assertUniqueEdgeId(definition: WorkflowDefinitionDocument, edgeId: string) {
  if (definition.edges.some((edge) => edge.id === edgeId)) {
    throw new AppError(`Duplicate edge id: ${edgeId}`, 400)
  }
}

function isStartNode(node: Pick<WorkflowNode, 'type'>) {
  return node.type === 'trigger.start'
}

function assertSingleStartNode(definition: WorkflowDefinitionDocument, nextNode: WorkflowNode) {
  if (!isStartNode(nextNode)) return
  if (definition.nodes.some(isStartNode)) {
    throw new AppError('Workflow can only contain one start node', 400)
  }
}

function findNode(definition: WorkflowDefinitionDocument, nodeId: string): WorkflowNode {
  const node = definition.nodes.find((item) => item.id === nodeId)
  if (!node) throw new AppError(`Node not found: ${nodeId}`, 404)
  return node
}

function assertNodeEditable(node: WorkflowNode, force?: boolean) {
  if (node.meta?.locked && !force) {
    throw new AppError(`Node is locked: ${node.id}`, 409)
  }
}

function assertEdgeEndpoints(definition: WorkflowDefinitionDocument, edge: WorkflowEdge) {
  findNode(definition, edge.source)
  findNode(definition, edge.target)
}

function assertAcyclic(definition: WorkflowDefinitionDocument) {
  const adj = new Map<string, string[]>()
  const visiting = new Set<string>()
  const visited = new Set<string>()

  for (const node of definition.nodes) adj.set(node.id, [])
  for (const edge of definition.edges) {
    adj.get(edge.source)?.push(edge.target)
  }

  function visit(nodeId: string): boolean {
    if (visiting.has(nodeId)) return false
    if (visited.has(nodeId)) return true

    visiting.add(nodeId)
    for (const next of adj.get(nodeId) ?? []) {
      if (!visit(next)) return false
    }
    visiting.delete(nodeId)
    visited.add(nodeId)
    return true
  }

  for (const node of definition.nodes) {
    if (!visit(node.id)) throw new AppError('Workflow graph cannot contain cycles', 400)
  }
}

function validateNodeDataPatch(
  nodeType: string,
  patch: Record<string, unknown>,
  warnings: string[],
) {
  const entry = ensureNodeType(nodeType)
  const allowed = new Set([
    ...Object.keys(entry.def.executeInput),
    'label',
    'color',
    'status',
    'outputs',
    'customOutputs',
  ])

  for (const key of Object.keys(patch)) {
    if (!allowed.has(key)) {
      warnings.push(`Unknown data field "${key}" for node type "${nodeType}"`)
    }
  }
}

function applyOp(definition: WorkflowDefinitionDocument, op: WorkflowEditOp, warnings: string[]) {
  switch (op.type) {
    case 'workflow.rename':
      return

    case 'node.add': {
      assertUniqueNodeId(definition, op.node.id)
      assertSingleStartNode(definition, op.node)
      definition.nodes.push(normalizeNode(op.node, warnings))
      return
    }

    case 'node.update': {
      const node = findNode(definition, op.nodeId)
      assertNodeEditable(node, op.force)
      if (op.dataPatch) {
        validateNodeDataPatch(node.type, op.dataPatch, warnings)
        node.data = { ...(node.data ?? {}), ...op.dataPatch }
      }
      if (op.position) node.position = op.position
      if (op.metaPatch) node.meta = { ...(node.meta ?? {}), ...op.metaPatch }
      return
    }

    case 'node.delete': {
      const node = findNode(definition, op.nodeId)
      assertNodeEditable(node, op.force)
      definition.nodes = definition.nodes.filter((item) => item.id !== op.nodeId)
      definition.edges = definition.edges.filter(
        (edge) => edge.source !== op.nodeId && edge.target !== op.nodeId,
      )
      return
    }

    case 'edge.add': {
      assertUniqueEdgeId(definition, op.edge.id)
      assertEdgeEndpoints(definition, op.edge)
      definition.edges.push(op.edge)
      assertAcyclic(definition)
      return
    }

    case 'edge.update': {
      const edge = definition.edges.find((item) => item.id === op.edgeId)
      if (!edge) throw new AppError(`Edge not found: ${op.edgeId}`, 404)
      Object.assign(edge, op.patch)
      assertEdgeEndpoints(definition, edge)
      assertAcyclic(definition)
      return
    }

    case 'edge.delete':
      if (!definition.edges.some((edge) => edge.id === op.edgeId)) {
        throw new AppError(`Edge not found: ${op.edgeId}`, 404)
      }
      definition.edges = definition.edges.filter((edge) => edge.id !== op.edgeId)
      return

    case 'node.insertBetween': {
      const edge = definition.edges.find((item) => item.id === op.edgeId)
      if (!edge) throw new AppError(`Edge not found: ${op.edgeId}`, 404)

      assertUniqueNodeId(definition, op.node.id)
      assertSingleStartNode(definition, op.node)
      const node = normalizeNode(op.node, warnings)
      const sourceToNewEdgeId = op.sourceToNewEdge?.id ?? `${edge.source}-${node.id}`
      const newToTargetEdgeId = op.newToTargetEdge?.id ?? `${node.id}-${edge.target}`
      assertUniqueEdgeId(definition, sourceToNewEdgeId)
      assertUniqueEdgeId(definition, newToTargetEdgeId)

      definition.nodes.push(node)
      definition.edges = definition.edges.filter((item) => item.id !== op.edgeId)
      definition.edges.push(
        {
          id: sourceToNewEdgeId,
          source: edge.source,
          target: node.id,
          sourceHandle: edge.sourceHandle,
          targetHandle: op.sourceToNewEdge?.targetHandle,
          ...op.sourceToNewEdge,
        },
        {
          id: newToTargetEdgeId,
          source: node.id,
          target: edge.target,
          sourceHandle: op.newToTargetEdge?.sourceHandle,
          targetHandle: edge.targetHandle,
          ...op.newToTargetEdge,
        },
      )
      assertAcyclic(definition)
      return
    }
  }
}

export async function applyWorkflowOps(
  userId: string,
  workflowId: string,
  request: ApplyWorkflowOpsRequest,
): Promise<ApplyWorkflowOpsResult> {
  if (!Array.isArray(request.ops) || request.ops.length === 0) {
    throw new AppError('ops is required', 400)
  }

  const workflow = ensureWorkflowOwner(await workflowRepo.findById(workflowId), userId)
  if (request.baseUpdatedAt && workflow.updatedAt.toISOString() !== request.baseUpdatedAt) {
    throw new AppError('Workflow has changed. Refresh before applying edits.', 409)
  }

  const definition = parseDefinition(workflow.definition)
  const warnings: string[] = []

  for (const op of request.ops) {
    applyOp(definition, op, warnings)
  }

  assertAcyclic(definition)

  const renameOp = [...request.ops].reverse().find((op) => op.type === 'workflow.rename')
  const updated = await workflowRepo.update(workflow.id, {
    ...(renameOp?.type === 'workflow.rename'
      ? { name: renameOp.name, description: renameOp.description }
      : {}),
    definition: serializeDefinition(definition),
  })

  return {
    workflow: updated,
    appliedOps: request.ops.length,
    warnings,
  }
}

export { parseDefinition, serializeDefinition }
