import type { WorkflowDefinition, WorkflowDefinitionDocument } from '@eous/api-client'
import type { z } from 'zod'
import type { AgentSkill, AgentSkillContext, AgentSkillTool } from '../../types.js'
import type {
  WorkflowCapability,
  WorkflowCapabilityNode,
  WorkflowNodeExecutionRecord,
  WorkflowRecord,
} from '../capability.js'
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
} from '../schemas.js'

type WorkflowDefinitionDoc = {
  schemaVersion: 1
  nodes: WorkflowDefinitionDocument['nodes']
  edges: WorkflowDefinitionDocument['edges']
  viewport?: { x: number; y: number; zoom: number }
}

function parseWorkflowDefinition(raw: string): WorkflowDefinitionDoc {
  try {
    const parsed = JSON.parse(raw) as Partial<WorkflowDefinitionDocument> & {
      viewport?: { x: number; y: number; zoom: number }
    }
    return {
      schemaVersion: 1,
      nodes: Array.isArray(parsed.nodes)
        ? parsed.nodes.map((node) => normalizeNode(node as WorkflowCapabilityNode))
        : [],
      edges: Array.isArray(parsed.edges) ? parsed.edges : [],
      ...(parsed.viewport ? { viewport: parsed.viewport } : {}),
    }
  } catch {
    return { schemaVersion: 1, nodes: [], edges: [] }
  }
}

function normalizeNode(node: WorkflowCapabilityNode): WorkflowDefinitionDocument['nodes'][number] {
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
    currentSeq: workflow.currentSeq ?? 0,
    enabled: false,
    activeVersionId: null,
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

export function createWorkflowSkill(capability: WorkflowCapability): AgentSkill {
  const tools = [
    makeTool({
      id: 'workflow_list',
      description: 'List workflows available to the current user. Optionally filter by name.',
      inputSchema: workflowListInputSchema as z.ZodType<WorkflowListInput>,
      readOnly: true,
      async execute(context: AgentSkillContext, input: WorkflowListInput) {
        const workflows = await capability.list({
          userId: context.userId,
          query: input.query,
          limit: input.limit,
        })

        return {
          workflows: workflows.map((workflow) => ({
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
        const workflow = await capability.get({
          userId: context.userId,
          workflowId: input.workflowId,
        })
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
        const result = await capability.applyOps({
          userId: context.userId,
          workflowId: input.workflowId,
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
        return capability.run({
          userId: context.userId,
          workflowId: input.workflowId,
          input: input.input,
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
        const execution = await capability.runNode({
          userId: context.userId,
          workflowId: input.workflowId,
          nodeId: input.nodeId,
          input: input.input,
        })
        return { execution: toExecutionDTO(execution) }
      },
    }),
    makeTool({
      id: 'workflow_get_variables',
      description: 'Read the latest successful output cache for workflow nodes.',
      inputSchema: workflowVariablesInputSchema as z.ZodType<WorkflowVariablesInput>,
      readOnly: true,
      async execute(_context: AgentSkillContext, input: WorkflowVariablesInput) {
        const variables = await capability.getVariables({ workflowId: input.workflowId })
        return { variables }
      },
    }),
    makeTool({
      id: 'workflow_get_executions',
      description: 'Read recent node execution records for a workflow.',
      inputSchema: workflowExecutionsInputSchema as z.ZodType<WorkflowExecutionsInput>,
      readOnly: true,
      async execute(_context: AgentSkillContext, input: WorkflowExecutionsInput) {
        const executions = await capability.getExecutions({
          workflowId: input.workflowId,
          limit: input.limit,
        })
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
