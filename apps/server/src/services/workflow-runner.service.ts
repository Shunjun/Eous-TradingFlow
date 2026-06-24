import { createHash } from 'node:crypto'
import { prisma, type WorkflowNodeExecution } from '@eous/db'
import { executors } from '@eous/nodes/server'
import type {
  CustomOutputDef,
  ExecuteContext,
  LogLevel,
  LogEntry,
  DataSourceService,
  LlmService,
} from '@eous/nodes/types'
import { resolveString, resolveValue } from '../lib/var-resolver.js'
import * as dataSourceService from './data-source.service.js'
import * as llmServiceModule from './llm/llm.service.js'

type NodeExecutor = (
  input: Record<string, unknown>,
  ctx: ExecuteContext,
) => Promise<Record<string, unknown>>

const EXECUTORS: Record<string, NodeExecutor> = executors as Record<string, NodeExecutor>
const WHOLE_VAR_RE = /^{{([^{}]+)}}$/

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
  sourceHandle?: string
  targetHandle?: string
}

interface ExecuteNodeSequenceOptions {
  workflowId: string
  userId: string
  nodesToRun: WorkflowNode[]
  allNodes: WorkflowNode[]
  allEdges: WorkflowEdge[]
  workflowInput?: Record<string, unknown>
  useCache: boolean
}

// Node schema version — bump when node data structure changes so old cached
// executions automatically invalidate (different hash → cache miss → re-execute).
const NODE_SCHEMA_VERSION: Record<string, number> = {
  'source.kline': 2, // 派单 12: provider+exchange → dataSourceInstanceId
  'source.price': 2, // 同上
}

function getCustomOutputs(data: Record<string, unknown>): CustomOutputDef[] {
  if (!Array.isArray(data.customOutputs)) return []
  return data.customOutputs.filter((item): item is CustomOutputDef => {
    if (!item || typeof item !== 'object') return false
    const output = item as Record<string, unknown>
    return typeof output.name === 'string' && typeof output.expression === 'string'
  })
}

function splitOutputPath(path: string): string[] {
  const parts: string[] = []
  let current = ''
  for (let i = 0; i < path.length; i++) {
    const ch = path[i]
    if (ch === '.' || ch === '[' || ch === ']') {
      if (current) parts.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current) parts.push(current)
  return parts
}

function resolveOutputExpression(outputs: Record<string, unknown>, expression: string): unknown {
  const path = expression.trim()
  if (!path) return undefined
  let current: unknown = outputs
  for (const part of splitOutputPath(path)) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function applyCustomOutputs(
  outputs: Record<string, unknown>,
  node: WorkflowNode,
  log: (level: LogLevel, message: string) => void,
): Record<string, unknown> {
  const customOutputs = getCustomOutputs(node.data)
  if (customOutputs.length === 0) return outputs

  const next = { ...outputs }
  for (const output of customOutputs) {
    const name = output.name.trim()
    const expression = output.expression.trim()
    if (!name || !expression) continue
    const value = resolveOutputExpression(outputs, expression)
    if (value === undefined) {
      log('warn', `额外输出 "${name}" 取值失败: ${expression}`)
      continue
    }
    next[name] = value
  }
  return next
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

function resolveInputValue(
  value: unknown,
  varCache: Record<string, Record<string, unknown>>,
  allNodes: WorkflowNode[],
): unknown {
  if (typeof value === 'string') {
    return WHOLE_VAR_RE.test(value)
      ? resolveValue(value, varCache, allNodes)
      : resolveString(value, varCache, allNodes)
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveInputValue(item, varCache, allNodes))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        resolveInputValue(item, varCache, allNodes),
      ]),
    )
  }
  return value
}

function isBranchEdgeActive(
  edge: WorkflowEdge,
  sourceNode: WorkflowNode | undefined,
  varCache: Record<string, Record<string, unknown>>,
): boolean {
  if (sourceNode?.type !== 'control.branch') return true
  const selectedBranch = varCache[edge.source]?.__selectedBranch
  return typeof selectedBranch === 'string' && edge.sourceHandle === selectedBranch
}

function getReachableNodeIds(startNodeId: string, edges: WorkflowEdge[]): Set<string> {
  const reachable = new Set<string>([startNodeId])
  const queue = [startNodeId]

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const edge of edges) {
      if (edge.source !== current || reachable.has(edge.target)) continue
      reachable.add(edge.target)
      queue.push(edge.target)
    }
  }

  return reachable
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

function createLlmService(userId: string): LlmService {
  return {
    streamChat: (options) =>
      llmServiceModule.streamChat({
        userId,
        ...options,
        context: options.context as Parameters<typeof llmServiceModule.streamChat>[0]['context'],
      }),
    parseJsonWithTolerance: llmServiceModule.parseJsonWithTolerance,
  }
}

async function executeNodeSequence({
  workflowId,
  userId,
  nodesToRun,
  allNodes,
  allEdges,
  workflowInput = {},
  useCache,
}: ExecuteNodeSequenceOptions): Promise<Map<string, WorkflowNodeExecution>> {
  const varCache: Record<string, Record<string, unknown>> = {}
  const nodeMap = new Map(allNodes.map((node) => [node.id, node]))
  const skippedNodes = new Set<string>()
  const executionResults = new Map<string, WorkflowNodeExecution>()

  for (const node of nodesToRun) {
    const upstreamEdges = allEdges.filter((e) => e.target === node.id)
    const activeUpstreamEdges = upstreamEdges.filter((edge) => {
      if (skippedNodes.has(edge.source)) return false
      if (!varCache[edge.source]) return false
      return isBranchEdgeActive(edge, nodeMap.get(edge.source), varCache)
    })

    if (upstreamEdges.length > 0 && activeUpstreamEdges.length === 0) {
      skippedNodes.add(node.id)
      continue
    }

    const upstreamIds = activeUpstreamEdges.map((e) => e.source)
    const upstreamOutputs: Record<string, Record<string, unknown>> = {}
    for (const uid of upstreamIds) {
      upstreamOutputs[uid] = varCache[uid] ?? {}
    }

    const definitionHash = computeDefinitionHash(node)
    const canUseCache = useCache && !node.type.startsWith('trigger.')
    const cached = canUseCache
      ? await prisma.workflowNodeExecution.findFirst({
          where: { workflowId, nodeId: node.id, definitionHash, status: 'succeeded' },
          orderBy: { startedAt: 'desc' },
        })
      : null

    if (cached) {
      executionResults.set(node.id, cached)
      if (cached.outputs) {
        varCache[node.id] = JSON.parse(cached.outputs)
      }
      continue
    }

    const logs: LogEntry[] = []
    const executionId = `exec_${Date.now()}_${node.id}`
    const ctx: ExecuteContext = {
      dataSourceService: dataSourceServiceImpl,
      llmService: createLlmService(userId),
      workflowInput,
      userId,
      workflowId,
      executionId,
      nodeId: node.id,
      upstreamOutputs,
      log: (level: LogLevel, message: string) => {
        logs.push({ ts: new Date().toISOString(), level, message })
      },
    }

    const resolvedInput: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(node.data)) {
      if (key === 'label' || key === '__meta') continue
      resolvedInput[key] = resolveInputValue(value, varCache, allNodes)
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
        const rawOutputs = await executor(resolvedInput, ctx)
        outputs = applyCustomOutputs(rawOutputs, node, ctx.log)
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

    if (outputs) {
      varCache[node.id] = outputs
    }
  }

  return executionResults
}

export async function runNode(
  workflowId: string,
  userId: string,
  targetNode: WorkflowNode,
  allNodes: WorkflowNode[],
  allEdges: WorkflowEdge[],
  workflowInput: Record<string, unknown> = {},
): Promise<WorkflowNodeExecution> {
  const sorted = topoSort(allNodes, allEdges)
  const targetIdx = sorted.findIndex((n) => n.id === targetNode.id)
  if (targetIdx === -1) {
    throw new Error(`Node ${targetNode.id} not found in workflow`)
  }

  const nodesToRun = sorted.slice(0, targetIdx + 1)
  const executionResults = await executeNodeSequence({
    workflowId,
    userId,
    nodesToRun,
    allNodes,
    allEdges,
    workflowInput,
    useCache: true,
  })

  const targetExecution = executionResults.get(targetNode.id)
  if (!targetExecution) {
    throw new Error(`Node ${targetNode.id} was not executed because its branch is inactive`)
  }

  return targetExecution
}

export async function runWorkflow(
  workflowId: string,
  userId: string,
  allNodes: WorkflowNode[],
  allEdges: WorkflowEdge[],
  options: {
    workflowInput?: Record<string, unknown>
    triggerNodeId?: string
    triggeredBy?: 'manual' | 'cron' | 'event'
  } = {},
) {
  const { workflowInput = {}, triggerNodeId, triggeredBy = 'manual' } = options
  const sorted = topoSort(allNodes, allEdges)
  const triggerNode = triggerNodeId
    ? sorted.find((node) => node.id === triggerNodeId)
    : sorted.find((node) => node.type === 'trigger.start')
  const nodesToRun = triggerNode
    ? sorted.filter((node) => getReachableNodeIds(triggerNode.id, allEdges).has(node.id))
    : sorted

  const executionResults = await executeNodeSequence({
    workflowId,
    userId,
    nodesToRun,
    allNodes,
    allEdges,
    workflowInput,
    useCache: false,
  })

  const nodeResults = Object.fromEntries(
    [...executionResults.values()].map((execution) => [
      execution.nodeId,
      {
        nodeId: execution.nodeId,
        status: execution.status === 'succeeded' ? 'completed' : 'failed',
        inputData: execution.inputs ? JSON.parse(execution.inputs) : undefined,
        outputData: execution.outputs ? JSON.parse(execution.outputs) : undefined,
        error: execution.error ?? undefined,
        startedAt: execution.startedAt.toISOString(),
        finishedAt: execution.finishedAt?.toISOString(),
      },
    ]),
  )
  const failed = [...executionResults.values()].find(
    (execution) => execution.status !== 'succeeded',
  )
  const now = new Date().toISOString()

  return {
    id: `workflow_${Date.now()}`,
    workflowId,
    status: failed ? 'failed' : 'completed',
    triggeredBy,
    nodeResults,
    startedAt: now,
    finishedAt: now,
    error: failed?.error ?? undefined,
  }
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
