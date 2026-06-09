import { createHash } from 'node:crypto'
import { prisma, type WorkflowNodeExecution } from '@eous/db'
import { sourceKline, sourcePrice, controlBranch } from '@eous/nodes/server'
import type { ExecuteContext, LogLevel, LogEntry, DataSourceService } from '@eous/nodes/types'
import { resolveValue } from '../lib/var-resolver.js'
import * as dataSourceService from './data-source.service.js'

type NodeExecutor = (
  input: Record<string, unknown>,
  ctx: ExecuteContext,
) => Promise<Record<string, unknown>>

const EXECUTORS: Record<string, NodeExecutor> = {
  'source.kline': sourceKline as unknown as NodeExecutor,
  'source.price': sourcePrice as unknown as NodeExecutor,
  'control.branch': controlBranch as unknown as NodeExecutor,
}

interface WorkflowNode {
  id: string
  type: string
  data: Record<string, unknown>
  position?: { x: number; y: number }
}

interface WorkflowEdge {
  id: string
  source: string
  target: string
}

// Node schema version — bump when node data structure changes so old cached
// executions automatically invalidate (different hash → cache miss → re-execute).
const NODE_SCHEMA_VERSION: Record<string, number> = {
  'source.kline': 2, // 派单 12: provider+exchange → dataSourceInstanceId
  'source.price': 2, // 同上
}

function computeDefinitionHash(node: WorkflowNode): string {
  const userData = { ...node.data }
  delete userData.status
  delete userData.color
  delete userData.label

  const schemaVersion = NODE_SCHEMA_VERSION[node.type] ?? 1
  const payload = JSON.stringify({
    type: node.type,
    schemaVersion,
    data: userData,
  })
  return createHash('sha256').update(payload).digest('hex').slice(0, 16)
}

function topoSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const adj = new Map<string, string[]>()
  const inDeg = new Map<string, number>()
  for (const n of nodes) {
    adj.set(n.id, [])
    inDeg.set(n.id, 0)
  }
  for (const e of edges) {
    adj.get(e.source)?.push(e.target)
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1)
  }
  const queue: string[] = []
  for (const [id, deg] of inDeg) {
    if (deg === 0) queue.push(id)
  }
  const sorted: WorkflowNode[] = []
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  while (queue.length) {
    const id = queue.shift()!
    const node = nodeMap.get(id)
    if (node) sorted.push(node)
    for (const next of adj.get(id) ?? []) {
      inDeg.set(next, inDeg.get(next)! - 1)
      if (inDeg.get(next) === 0) queue.push(next)
    }
  }
  return sorted
}

const dataSourceServiceImpl: DataSourceService = {
  async getInstanceConfig(userId: string, instanceId: string) {
    const instance = await dataSourceService.getInstance(userId, instanceId)
    return {
      providerKind: instance.providerKind,
      config: instance.config,
    }
  },
}

export async function runNode(
  workflowId: string,
  userId: string,
  targetNode: WorkflowNode,
  allNodes: WorkflowNode[],
  allEdges: WorkflowEdge[],
): Promise<WorkflowNodeExecution> {
  const sorted = topoSort(allNodes, allEdges)
  const targetIdx = sorted.findIndex((n) => n.id === targetNode.id)
  if (targetIdx === -1) {
    throw new Error(`Node ${targetNode.id} not found in workflow`)
  }

  // Only run up to and including the target node
  const nodesToRun = sorted.slice(0, targetIdx + 1)

  // Variable cache: Record<nodeId, Record<fieldName, unknown>>
  const varCache: Record<string, Record<string, unknown>> = {}

  // Track execution results for upstream resolution
  const executionResults = new Map<string, WorkflowNodeExecution>()

  for (const node of nodesToRun) {
    const upstreamEdges = allEdges.filter((e) => e.target === node.id)
    const upstreamIds = upstreamEdges.map((e) => e.source)

    // Build upstreamOutputs from varCache
    const upstreamOutputs: Record<string, Record<string, unknown>> = {}
    for (const uid of upstreamIds) {
      upstreamOutputs[uid] = varCache[uid] ?? {}
    }

    // Compute definition hash
    const definitionHash = computeDefinitionHash(node)

    // Check cache
    const cached = await prisma.workflowNodeExecution.findFirst({
      where: { workflowId, nodeId: node.id, definitionHash, status: 'succeeded' },
      orderBy: { startedAt: 'desc' },
    })

    if (cached) {
      executionResults.set(node.id, cached)
      // Restore varCache from cached outputs
      if (cached.outputs) {
        varCache[node.id] = JSON.parse(cached.outputs)
      }
      continue
    }

    // Build execution context with log collector
    const logs: LogEntry[] = []
    const executionId = `exec_${Date.now()}_${node.id}`
    const ctx: ExecuteContext = {
      dataSourceService: dataSourceServiceImpl,
      userId,
      workflowId,
      executionId,
      nodeId: node.id,
      upstreamOutputs,
      log: (level: LogLevel, message: string) => {
        logs.push({ ts: new Date().toISOString(), level, message })
      },
    }

    // Parse input: resolve variable references in node data
    const resolvedInput: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(node.data)) {
      if (key === 'label' || key === '__meta') continue
      resolvedInput[key] = resolveValue(value, varCache, allNodes)
    }

    const startTime = Date.now()
    let status = 'succeeded'
    let outputs: Record<string, unknown> | null = null
    let error: string | null = null

    const executor = EXECUTORS[node.type]
    if (!executor) {
      status = 'failed'
      error = `Unknown node type: ${node.type}`
      ctx.log('error', error)
    } else {
      try {
        outputs = await executor(resolvedInput, ctx)
      } catch (e) {
        status = 'failed'
        error = e instanceof Error ? e.message : String(e)
        ctx.log('error', `执行失败: ${error}`)
      }
    }

    const durationMs = Date.now() - startTime
    const now = new Date()

    const execution = await prisma.workflowNodeExecution.create({
      data: {
        workflowId,
        userId,
        nodeId: node.id,
        nodeType: node.type,
        status,
        inputs: JSON.stringify(resolvedInput),
        outputs: outputs ? JSON.stringify(outputs) : null,
        error,
        logs: JSON.stringify(logs),
        definitionHash,
        durationMs,
        startedAt: now,
        finishedAt: now,
      },
    })

    executionResults.set(node.id, execution)

    // Store outputs in varCache for downstream nodes
    if (outputs) {
      varCache[node.id] = outputs
    }
  }

  console.log(executionResults)

  return executionResults.get(targetNode.id)!
}

export async function getLastExecution(
  workflowId: string,
  nodeId: string,
): Promise<WorkflowNodeExecution | null> {
  return prisma.workflowNodeExecution.findFirst({
    where: { workflowId, nodeId },
    orderBy: { startedAt: 'desc' },
  })
}

export async function getWorkflowExecutions(
  workflowId: string,
  limit = 50,
): Promise<WorkflowNodeExecution[]> {
  return prisma.workflowNodeExecution.findMany({
    where: { workflowId },
    orderBy: { startedAt: 'desc' },
    take: limit,
  })
}

export async function getVariableCache(
  workflowId: string,
): Promise<Record<string, Record<string, unknown>>> {
  // Get the latest successful execution for each node
  const executions = await prisma.workflowNodeExecution.findMany({
    where: { workflowId, status: 'succeeded' },
    orderBy: { startedAt: 'desc' },
  })

  const cache: Record<string, Record<string, unknown>> = {}
  const seen = new Set<string>()

  for (const exec of executions) {
    if (seen.has(exec.nodeId)) continue
    seen.add(exec.nodeId)
    if (exec.outputs) {
      cache[exec.nodeId] = JSON.parse(exec.outputs)
    }
  }

  return cache
}
