import type {
  WorkflowCapability,
  WorkflowNodeExecutionRecord,
  WorkflowRecord,
} from '@eous/agent-skills'
import { AppError } from '../lib/app-error.js'
import * as workflowService from '../services/workflow.service.js'
import * as workflowEditService from '../services/workflow-edit.service.js'
import * as workflowRunner from '../services/workflow-runner.service.js'

export class ServerWorkflowCapability implements WorkflowCapability {
  async list(params: {
    userId: string
    query?: string
    limit?: number
  }): Promise<WorkflowRecord[]> {
    const workflows = await workflowService.listWorkflows(params.userId)
    const query = params.query?.trim().toLowerCase()
    const filtered = query
      ? workflows.filter((workflow) => workflow.name.toLowerCase().includes(query))
      : workflows

    return filtered.slice(0, params.limit ?? 20)
  }

  get(params: { userId: string; workflowId: string }): Promise<WorkflowRecord> {
    return workflowService.getWorkflow(params.userId, params.workflowId)
  }

  applyOps(params: {
    userId: string
    workflowId: string
    baseUpdatedAt?: string
    ops: unknown[]
  }): Promise<{ workflow: WorkflowRecord; appliedOps: number; warnings: string[] }> {
    return workflowEditService.applyWorkflowOps(params.userId, params.workflowId, {
      baseUpdatedAt: params.baseUpdatedAt,
      ops: params.ops as Parameters<typeof workflowEditService.applyWorkflowOps>[2]['ops'],
    })
  }

  async run(params: {
    userId: string
    workflowId: string
    input?: Record<string, unknown>
  }): Promise<unknown> {
    const workflow = await workflowService.getWorkflow(params.userId, params.workflowId)
    const definition = workflowEditService.parseDefinition(workflow.definition)
    return workflowRunner.runWorkflow(
      workflow.id,
      params.userId,
      definition.nodes,
      definition.edges,
      { workflowInput: params.input },
    )
  }

  async runNode(params: {
    userId: string
    workflowId: string
    nodeId: string
    input?: Record<string, unknown>
  }): Promise<WorkflowNodeExecutionRecord> {
    const workflow = await workflowService.getWorkflow(params.userId, params.workflowId)
    const definition = workflowEditService.parseDefinition(workflow.definition)
    const targetNode = definition.nodes.find((node) => node.id === params.nodeId)
    if (!targetNode) throw new AppError(`Node not found: ${params.nodeId}`, 404)

    return workflowRunner.runNode(
      workflow.id,
      params.userId,
      targetNode,
      definition.nodes,
      definition.edges,
      params.input,
    )
  }

  getVariables(params: { workflowId: string }): Promise<Record<string, Record<string, unknown>>> {
    return workflowRunner.getVariableCache(params.workflowId)
  }

  getExecutions(params: {
    workflowId: string
    limit?: number
  }): Promise<WorkflowNodeExecutionRecord[]> {
    return workflowRunner.getWorkflowExecutions(params.workflowId, params.limit)
  }
}

export const workflowCapability = new ServerWorkflowCapability()
