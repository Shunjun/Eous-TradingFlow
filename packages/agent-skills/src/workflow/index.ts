import type { WorkflowDefinition, WorkflowDefinitionDocument } from '@eous/api-client'
import type { z } from 'zod'
import type { AgentSkill, AgentSkillContext, AgentSkillTool } from '../types.js'
import {
  workflowApplyOpsInputSchema,
  workflowExecutionsInputSchema,
  workflowGetInputSchema,
  workflowListInputSchema,
  workflowRunInputSchema,
  workflowRunNodeInputSchema,
  workflowVariablesInputSchema,
  type WorkflowApplyOpsInput,
  type WorkflowExecutionsInput,
  type WorkflowGetInput,
  type WorkflowListInput,
  type WorkflowRunInput,
  type WorkflowRunNodeInput,
  type WorkflowVariablesInput,
} from './schemas.js'

export interface WorkflowRecord {
  id: string
  name: string
  description: string | null
  definition: string
  createdAt: Date
  updatedAt: Date
}

export interface WorkflowNodeExecutionRecord {
  id: string
  workflowId: string
  userId: string
  nodeId: string
  nodeType: string
  status: string
  inputs: string
  outputs: string | null
  error: string | null
  logs: string
  definitionHash: string
  durationMs: number | null
  startedAt: Date
  finishedAt: Date | null
}

export interface WorkflowSkillDeps {
  listWorkflows(userId: string): Promise<WorkflowRecord[]>
  getWorkflow(userId: string, workflowId: string): Promise<WorkflowRecord>
  applyWorkflowOps(
    userId: string,
    workflowId: string,
    request: { baseUpdatedAt?: string; ops: unknown[] },
  ): Promise<{ workflow: WorkflowRecord; appliedOps: number; warnings: string[] }>
  runWorkflow(
    workflowId: string,
    userId: string,
    nodes: WorkflowDefinitionDocument['nodes'],
    edges: WorkflowDefinitionDocument['edges'],
    options: { workflowInput?: Record<string, unknown> },
  ): Promise<unknown>
  runNode(
    workflowId: string,
    userId: string,
    targetNode: WorkflowDefinitionDocument['nodes'][number],
    nodes: WorkflowDefinitionDocument['nodes'],
    edges: WorkflowDefinitionDocument['edges'],
    workflowInput?: Record<string, unknown>,
  ): Promise<WorkflowNodeExecutionRecord>
  getVariableCache(workflowId: string): Promise<Record<string, Record<string, unknown>>>
  getWorkflowExecutions(workflowId: string, limit?: number): Promise<WorkflowNodeExecutionRecord[]>
}

type WorkflowNodeDef = {
  id: string
  type: string
  data: Record<string, unknown>
  position: { x: number; y: number }
  meta?: {
    locked?: boolean
    createdBy?: 'user' | 'agent'
    updatedBy?: string
  }
}

type WorkflowEdgeDef = {
  id: string
  source: string
  sourceHandle?: string
  target: string
  targetHandle?: string
}

type WorkflowDefinitionDoc = {
  schemaVersion: 1
  nodes: WorkflowNodeDef[]
  edges: WorkflowEdgeDef[]
  viewport?: { x: number; y: number; zoom: number }
}

function parseWorkflowDefinition(raw: string): WorkflowDefinitionDoc {
  try {
    const parsed = JSON.parse(raw) as Partial<WorkflowDefinitionDoc>
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

function normalizeNode(node: WorkflowNodeDef): WorkflowNodeDef {
  return {
    ...node,
    position: node.position ?? { x: 0, y: 0 },
    data: node.data ?? {},
  }
}

function toWorkflowDefinition(workflow: WorkflowRecord): WorkflowDefinition {
  const definition = parseWorkflowDefinition(workflow.definition)
  return {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description ?? undefined,
    nodes: definition.nodes.map(normalizeNode),
    edges: definition.edges,
    viewport: definition.viewport,
    createdAt: workflow.createdAt.toISOString(),
    updatedAt: workflow.updatedAt.toISOString(),
  }
}

function parseJsonField(raw: string | null): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function toExecutionDTO(execution: WorkflowNodeExecutionRecord) {
  return {
    id: execution.id,
    workflowId: execution.workflowId,
    nodeId: execution.nodeId,
    nodeType: execution.nodeType,
    status: execution.status,
    inputs: parseJsonField(execution.inputs),
    outputs: parseJsonField(execution.outputs),
    error: execution.error,
    logs: parseJsonField(execution.logs) ?? [],
    durationMs: execution.durationMs,
    startedAt: execution.startedAt.toISOString(),
    finishedAt: execution.finishedAt?.toISOString() ?? null,
  }
}

function makeTool<TInput, TOutput>(
  tool: AgentSkillTool<TInput, TOutput>,
): AgentSkillTool<TInput, TOutput> {
  return tool
}

export function createWorkflowSkill(deps: WorkflowSkillDeps): AgentSkill {
  const tools = [
    makeTool({
      id: 'workflow_list',
      description: 'List workflows available to the current user. Optionally filter by name.',
      inputSchema: workflowListInputSchema as z.ZodType<WorkflowListInput>,
      readOnly: true,
      async execute(context: AgentSkillContext, input: WorkflowListInput) {
        const workflows = await deps.listWorkflows(context.userId)
        const query = input.query?.trim().toLowerCase()
        const filtered = query
          ? workflows.filter((workflow) => workflow.name.toLowerCase().includes(query))
          : workflows

        return {
          workflows: filtered.slice(0, input.limit).map((workflow) => ({
            id: workflow.id,
            name: workflow.name,
            description: workflow.description,
            updatedAt: workflow.updatedAt.toISOString(),
          })),
        }
      },
    }),
    makeTool({
      id: 'workflow_get',
      description: 'Read a workflow definition, including nodes, edges, viewport, and timestamps.',
      inputSchema: workflowGetInputSchema as z.ZodType<WorkflowGetInput>,
      readOnly: true,
      async execute(context: AgentSkillContext, input: WorkflowGetInput) {
        const workflow = await deps.getWorkflow(context.userId, input.workflowId)
        return { workflow: toWorkflowDefinition(workflow) }
      },
    }),
    makeTool({
      id: 'workflow_apply_ops',
      description:
        'Apply structured workflow edit operations. Use small, reviewable ops and include baseUpdatedAt when available.',
      inputSchema: workflowApplyOpsInputSchema as z.ZodType<WorkflowApplyOpsInput>,
      destructive: true,
      async execute(context: AgentSkillContext, input: WorkflowApplyOpsInput) {
        const result = await deps.applyWorkflowOps(context.userId, input.workflowId, {
          baseUpdatedAt: input.baseUpdatedAt,
          ops: input.ops as unknown[],
        })
        return {
          workflow: toWorkflowDefinition(result.workflow),
          appliedOps: result.appliedOps,
          warnings: result.warnings,
        }
      },
    }),
    makeTool({
      id: 'workflow_run',
      description: 'Run a workflow with optional workflow input and return node execution results.',
      inputSchema: workflowRunInputSchema as z.ZodType<WorkflowRunInput>,
      destructive: true,
      async execute(context: AgentSkillContext, input: WorkflowRunInput) {
        const workflow = await deps.getWorkflow(context.userId, input.workflowId)
        const definition = parseWorkflowDefinition(workflow.definition)
        return deps.runWorkflow(workflow.id, context.userId, definition.nodes, definition.edges, {
          workflowInput: input.input,
        })
      },
    }),
    makeTool({
      id: 'workflow_run_node',
      description:
        'Run one workflow node and its required upstream nodes, using cached successful upstream executions when possible.',
      inputSchema: workflowRunNodeInputSchema as z.ZodType<WorkflowRunNodeInput>,
      destructive: true,
      async execute(context: AgentSkillContext, input: WorkflowRunNodeInput) {
        const workflow = await deps.getWorkflow(context.userId, input.workflowId)
        const definition = parseWorkflowDefinition(workflow.definition)
        const targetNode = definition.nodes.find((node) => node.id === input.nodeId)
        if (!targetNode) throw new Error(`Node not found: ${input.nodeId}`)
        const execution = await deps.runNode(
          workflow.id,
          context.userId,
          targetNode,
          definition.nodes,
          definition.edges,
          input.input,
        )
        return { execution: toExecutionDTO(execution) }
      },
    }),
    makeTool({
      id: 'workflow_get_variables',
      description: 'Read the latest successful output cache for workflow nodes.',
      inputSchema: workflowVariablesInputSchema as z.ZodType<WorkflowVariablesInput>,
      readOnly: true,
      async execute(_context: AgentSkillContext, input: WorkflowVariablesInput) {
        const variables = await deps.getVariableCache(input.workflowId)
        return { variables }
      },
    }),
    makeTool({
      id: 'workflow_get_executions',
      description: 'Read recent node execution records for a workflow.',
      inputSchema: workflowExecutionsInputSchema as z.ZodType<WorkflowExecutionsInput>,
      readOnly: true,
      async execute(_context: AgentSkillContext, input: WorkflowExecutionsInput) {
        const executions = await deps.getWorkflowExecutions(input.workflowId, input.limit)
        return { executions: executions.map(toExecutionDTO) }
      },
    }),
  ] satisfies AgentSkillTool<any, any>[]

  return {
    id: '@eous/workflow',
    name: 'Workflow',
    description: 'Inspect, edit, and run Eous workflows through structured operations.',
    tools,
  }
}

export * from './schemas.js'
