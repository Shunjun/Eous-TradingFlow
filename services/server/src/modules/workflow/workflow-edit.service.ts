import type {
  ApplyWorkflowOpsRequest,
  WorkflowDefinitionDocument,
  WorkflowEditOp,
  WorkflowEdge,
  WorkflowNode,
} from '@eous/api-client'
import { prisma } from '@eous/db'
import { nodeRegistry } from '@eous/nodes/server'
import type { ParamDef } from '@eous/nodes/types'
import { AppError } from '../../lib/app-error.js'
import * as workflowRepo from './workflow.repo.js'

interface ApplyWorkflowOpsResult {
  workflow: Awaited<ReturnType<typeof workflowRepo.update>>
  appliedOps: number
  warnings: string[]
}

interface ApplyWorkflowEventRequest {
  baseSeq: number
  ops: WorkflowEditOp[]
  label?: string
  clientBatchId?: string
}

interface CreateSnapshotRequest {
  name?: string
}

type WorkflowEditEventRecord = {
  id: string
  workflowId: string
  userId: string
  seq: number
  kind: string
  label: string | null
  opsJson: string
  inverseOpsJson: string
  snapshotName: string | null
  snapshotDefinition: string | null
  targetVersionId: string | null
  targetDefinition: string | null
  clientBatchId: string | null
  targetSeq: number | null
  createdAt: Date
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

function parseOpsJson(raw: string): WorkflowEditOp[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as WorkflowEditOp[]) : []
  } catch {
    return []
  }
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

function cloneDefinition(definition: WorkflowDefinitionDocument): WorkflowDefinitionDocument {
  return JSON.parse(JSON.stringify(definition)) as WorkflowDefinitionDocument
}

function invertOps(
  initialDefinition: WorkflowDefinitionDocument,
  ops: WorkflowEditOp[],
): WorkflowEditOp[] {
  const cursor = cloneDefinition(initialDefinition)
  const inverse: WorkflowEditOp[] = []
  const warnings: string[] = []

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
              ? { metaPatch: { locked: node.meta?.locked } }
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
            ...connectedEdges.map((edge): WorkflowEditOp => ({ type: 'edge.add', edge })),
          )
          inverse.unshift({ type: 'node.add', node })
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
            patch[key] = edge[key] as never
          }
          inverse.unshift({ type: 'edge.update', edgeId: op.edgeId, patch })
        }
        break
      }

      case 'edge.delete': {
        const edge = cursor.edges.find((item) => item.id === op.edgeId)
        if (edge) inverse.unshift({ type: 'edge.add', edge })
        break
      }

      case 'node.insertBetween': {
        const edge = cursor.edges.find((item) => item.id === op.edgeId)
        if (edge) {
          inverse.unshift({ type: 'edge.add', edge })
          inverse.unshift({ type: 'node.delete', nodeId: op.node.id, force: true })
        }
        break
      }
    }

    applyOp(cursor, op, warnings)
  }

  return inverse
}

function serializeEvent(event: WorkflowEditEventRecord) {
  return {
    id: event.id,
    workflowId: event.workflowId,
    seq: event.seq,
    kind: event.kind,
    label: event.label,
    ops: parseOpsJson(event.opsJson),
    inverseOps: parseOpsJson(event.inverseOpsJson),
    snapshotName: event.snapshotName,
    targetVersionId: event.targetVersionId,
    targetSeq: event.targetSeq,
    createdAt: event.createdAt.toISOString(),
  }
}

function computeHistoryStacks(events: WorkflowEditEventRecord[]) {
  const bySeq = new Map(events.map((event) => [event.seq, event]))
  const undoStack: WorkflowEditEventRecord[] = []
  const redoStack: WorkflowEditEventRecord[] = []

  for (const event of events) {
    if (
      event.kind === 'op' ||
      event.kind === 'redo' ||
      event.kind === 'restore' ||
      event.kind === 'restore_snapshot' ||
      event.kind === 'restore_version'
    ) {
      const target = event.kind === 'redo' && event.targetSeq ? bySeq.get(event.targetSeq) : event
      if (target) {
        undoStack.push(target)
        if (event.kind === 'redo' && event.targetSeq) {
          const idx = redoStack.findIndex((item) => item.seq === event.targetSeq)
          if (idx >= 0) redoStack.splice(idx, 1)
        } else {
          redoStack.length = 0
        }
      }
    } else if (event.kind === 'undo' && event.targetSeq) {
      const idx = undoStack.findIndex((item) => item.seq === event.targetSeq)
      const [target] = idx >= 0 ? undoStack.splice(idx, 1) : [bySeq.get(event.targetSeq)]
      if (target) redoStack.push(target)
    }
  }

  return { undoStack, redoStack }
}

async function createEditEvent(params: {
  workflowId: string
  userId: string
  kind: string
  label?: string
  ops?: WorkflowEditOp[]
  inverseOps?: WorkflowEditOp[]
  snapshotName?: string
  snapshotDefinition?: string
  targetVersionId?: string
  targetDefinition?: string
  clientBatchId?: string
  targetSeq?: number
}) {
  const workflow = ensureWorkflowOwner(
    await workflowRepo.findById(params.workflowId),
    params.userId,
  )
  const seq = workflow.currentSeq + 1
  const event = await prisma.workflowEditEvent.create({
    data: {
      workflowId: params.workflowId,
      userId: params.userId,
      seq,
      kind: params.kind,
      label: params.label,
      opsJson: JSON.stringify(params.ops ?? []),
      inverseOpsJson: JSON.stringify(params.inverseOps ?? []),
      snapshotName: params.snapshotName,
      snapshotDefinition: params.snapshotDefinition,
      targetVersionId: params.targetVersionId,
      targetDefinition: params.targetDefinition,
      clientBatchId: params.clientBatchId,
      targetSeq: params.targetSeq,
    },
  })
  const updated = await workflowRepo.update(params.workflowId, { currentSeq: seq })
  return { workflow: updated, event }
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

export async function applyWorkflowEvent(
  userId: string,
  workflowId: string,
  request: ApplyWorkflowEventRequest,
) {
  if (!Array.isArray(request.ops) || request.ops.length === 0) {
    throw new AppError('ops is required', 400)
  }

  const existing =
    request.clientBatchId &&
    (await prisma.workflowEditEvent.findUnique({
      where: {
        workflowId_clientBatchId: {
          workflowId,
          clientBatchId: request.clientBatchId,
        },
      },
    }))
  if (existing) {
    const workflow = ensureWorkflowOwner(await workflowRepo.findById(workflowId), userId)
    return {
      workflow,
      event: serializeEvent(existing),
      warnings: [],
    }
  }

  const workflow = ensureWorkflowOwner(await workflowRepo.findById(workflowId), userId)
  if (workflow.currentSeq !== request.baseSeq) {
    throw new AppError('Workflow has changed. Refresh before applying edits.', 409)
  }

  const definition = parseDefinition(workflow.definition)
  const inverseOps = invertOps(definition, request.ops)
  const warnings: string[] = []
  for (const op of request.ops) {
    applyOp(definition, op, warnings)
  }
  assertAcyclic(definition)

  const seq = workflow.currentSeq + 1
  const updated = await prisma.$transaction(async (tx) => {
    const nextWorkflow = await tx.workflow.update({
      where: { id: workflowId },
      data: {
        definition: serializeDefinition(definition),
        currentSeq: seq,
      },
    })
    const event = await tx.workflowEditEvent.create({
      data: {
        workflowId,
        userId,
        seq,
        kind: 'op',
        label: request.label,
        opsJson: JSON.stringify(request.ops),
        inverseOpsJson: JSON.stringify(inverseOps),
        clientBatchId: request.clientBatchId,
      },
    })
    return { workflow: nextWorkflow, event }
  })

  return {
    workflow: updated.workflow,
    event: serializeEvent(updated.event),
    warnings,
  }
}

export async function listWorkflowHistory(userId: string, workflowId: string) {
  ensureWorkflowOwner(await workflowRepo.findById(workflowId), userId)
  const events = await prisma.workflowEditEvent.findMany({
    where: { workflowId },
    orderBy: { seq: 'asc' },
  })
  const { undoStack, redoStack } = computeHistoryStacks(events)
  return {
    events: events.map(serializeEvent),
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  }
}

export async function undoWorkflowEvent(userId: string, workflowId: string) {
  const workflow = ensureWorkflowOwner(await workflowRepo.findById(workflowId), userId)
  const events = await prisma.workflowEditEvent.findMany({
    where: { workflowId },
    orderBy: { seq: 'asc' },
  })
  const { undoStack } = computeHistoryStacks(events)
  const target = undoStack.at(-1)
  if (!target) throw new AppError('Nothing to undo', 400)

  const restoresDefinition = Boolean(target.snapshotDefinition)
  const ops = restoresDefinition ? [] : parseOpsJson(target.inverseOpsJson)
  const definition = restoresDefinition
    ? parseDefinition(target.snapshotDefinition!)
    : parseDefinition(workflow.definition)
  const warnings: string[] = []
  if (!restoresDefinition) {
    for (const op of ops) applyOp(definition, op, warnings)
  }

  const seq = workflow.currentSeq + 1
  const result = await prisma.$transaction(async (tx) => {
    const nextWorkflow = await tx.workflow.update({
      where: { id: workflowId },
      data: { definition: serializeDefinition(definition), currentSeq: seq },
    })
    const event = await tx.workflowEditEvent.create({
      data: {
        workflowId,
        userId,
        seq,
        kind: 'undo',
        label: `撤销 ${target.label ?? target.kind}`,
        opsJson: JSON.stringify(ops),
        inverseOpsJson: target.opsJson,
        snapshotDefinition: workflow.definition,
        targetDefinition: target.snapshotDefinition,
        targetSeq: target.seq,
      },
    })
    return { workflow: nextWorkflow, event }
  })

  return { workflow: result.workflow, event: serializeEvent(result.event), warnings }
}

export async function redoWorkflowEvent(userId: string, workflowId: string) {
  const workflow = ensureWorkflowOwner(await workflowRepo.findById(workflowId), userId)
  const events = await prisma.workflowEditEvent.findMany({
    where: { workflowId },
    orderBy: { seq: 'asc' },
  })
  const { redoStack } = computeHistoryStacks(events)
  const target = redoStack.at(-1)
  if (!target) throw new AppError('Nothing to redo', 400)

  const restoresDefinition = Boolean(target.targetDefinition)
  const ops = restoresDefinition ? [] : parseOpsJson(target.opsJson)
  const definition = restoresDefinition
    ? parseDefinition(target.targetDefinition!)
    : parseDefinition(workflow.definition)
  const warnings: string[] = []
  if (!restoresDefinition) {
    for (const op of ops) applyOp(definition, op, warnings)
  }

  const seq = workflow.currentSeq + 1
  const result = await prisma.$transaction(async (tx) => {
    const nextWorkflow = await tx.workflow.update({
      where: { id: workflowId },
      data: { definition: serializeDefinition(definition), currentSeq: seq },
    })
    const event = await tx.workflowEditEvent.create({
      data: {
        workflowId,
        userId,
        seq,
        kind: 'redo',
        label: `重做 ${target.label ?? target.kind}`,
        opsJson: JSON.stringify(ops),
        inverseOpsJson: target.inverseOpsJson,
        snapshotDefinition: workflow.definition,
        targetDefinition: target.targetDefinition,
        targetSeq: target.seq,
      },
    })
    return { workflow: nextWorkflow, event }
  })

  return { workflow: result.workflow, event: serializeEvent(result.event), warnings }
}

export async function createWorkflowSnapshot(
  userId: string,
  workflowId: string,
  request: CreateSnapshotRequest,
) {
  const workflow = ensureWorkflowOwner(await workflowRepo.findById(workflowId), userId)
  const result = await createEditEvent({
    workflowId,
    userId,
    kind: 'snapshot',
    label: request.name ?? '快照',
    snapshotName: request.name ?? `快照 ${workflow.currentSeq}`,
    snapshotDefinition: workflow.definition,
  })
  return { workflow: result.workflow, snapshot: serializeEvent(result.event) }
}

export async function listWorkflowSnapshots(userId: string, workflowId: string) {
  ensureWorkflowOwner(await workflowRepo.findById(workflowId), userId)
  const snapshots = await prisma.workflowEditEvent.findMany({
    where: { workflowId, kind: 'snapshot' },
    orderBy: { seq: 'desc' },
  })
  return { snapshots: snapshots.map(serializeEvent) }
}

export async function restoreWorkflowSnapshot(userId: string, workflowId: string, eventId: string) {
  const workflow = ensureWorkflowOwner(await workflowRepo.findById(workflowId), userId)
  const snapshot = await prisma.workflowEditEvent.findFirst({
    where: { id: eventId, workflowId, kind: 'snapshot' },
  })
  if (!snapshot?.snapshotDefinition) throw new AppError('Snapshot not found', 404)

  const previousDefinition = workflow.definition
  const seq = workflow.currentSeq + 1
  const result = await prisma.$transaction(async (tx) => {
    const nextWorkflow = await tx.workflow.update({
      where: { id: workflowId },
      data: { definition: snapshot.snapshotDefinition!, currentSeq: seq },
    })
    const event = await tx.workflowEditEvent.create({
      data: {
        workflowId,
        userId,
        seq,
        kind: 'restore_snapshot',
        label: `恢复 ${snapshot.snapshotName ?? '快照'}`,
        snapshotName: snapshot.snapshotName,
        snapshotDefinition: previousDefinition,
        targetDefinition: snapshot.snapshotDefinition!,
        targetSeq: snapshot.seq,
      },
    })
    return { workflow: nextWorkflow, event }
  })
  return { workflow: result.workflow, event: serializeEvent(result.event) }
}

export async function restoreWorkflowVersionToDraft(
  userId: string,
  workflowId: string,
  versionId: string,
) {
  const workflow = ensureWorkflowOwner(await workflowRepo.findById(workflowId), userId)
  const version = await workflowRepo.findVersionById(versionId)
  if (!version || version.workflowId !== workflowId) {
    throw new AppError('Workflow version not found', 404)
  }

  const previousDefinition = workflow.definition
  const seq = workflow.currentSeq + 1
  const result = await prisma.$transaction(async (tx) => {
    const nextWorkflow = await tx.workflow.update({
      where: { id: workflowId },
      data: { definition: version.definition, currentSeq: seq },
    })
    const event = await tx.workflowEditEvent.create({
      data: {
        workflowId,
        userId,
        seq,
        kind: 'restore_version',
        label: `从 v${version.version} 加载到草稿`,
        snapshotDefinition: previousDefinition,
        targetVersionId: version.id,
        targetDefinition: version.definition,
      },
    })
    return { workflow: nextWorkflow, event }
  })

  return { workflow: result.workflow, event: serializeEvent(result.event) }
}

export { parseDefinition, serializeDefinition, invertOps }
