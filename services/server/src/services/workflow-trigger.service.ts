import type { WorkflowWithActiveVersion } from '../repositories/workflow.repo.js'
import * as workflowRepo from '../repositories/workflow.repo.js'
import * as workflowRunner from './workflow-runner.service.js'

export type WorkflowTriggerKind = 'manual' | 'cron' | 'event' | 'webhook' | 'market-pattern'

export interface WorkflowNode {
  id: string
  type: string
  data: Record<string, unknown>
}

export interface WorkflowEdge {
  id: string
  source: string
  sourceHandle?: string
  target: string
  targetHandle?: string
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

export interface PublishedWorkflowTarget {
  workflow: WorkflowWithActiveVersion
  definition: WorkflowDefinition
  definitionSnapshot: string
}

export interface TriggerPublishedWorkflowOptions {
  workflow: WorkflowWithActiveVersion
  definition: WorkflowDefinition
  triggerNodeId: string
  triggerKind: WorkflowTriggerKind
  input?: Record<string, unknown>
}

export function parseWorkflowDefinition(definition: string): WorkflowDefinition | null {
  try {
    const parsed = JSON.parse(definition) as Partial<WorkflowDefinition>
    return {
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed.edges) ? parsed.edges : [],
    }
  } catch {
    return null
  }
}

export async function listPublishedWorkflowTargets(): Promise<PublishedWorkflowTarget[]> {
  const workflows = await workflowRepo.findEnabledWithActiveVersions()
  return workflows.flatMap((workflow) => {
    if (!workflow.activeVersion) return []
    const definition = parseWorkflowDefinition(workflow.activeVersion.definition)
    if (!definition) return []
    return [
      {
        workflow,
        definition,
        definitionSnapshot: workflow.activeVersion.definition,
      },
    ]
  })
}

export async function listPublishedWorkflowTriggerTargets(
  triggerNodeType: string,
): Promise<Array<PublishedWorkflowTarget & { triggerNode: WorkflowNode }>> {
  const targets = await listPublishedWorkflowTargets()
  return targets.flatMap((target) =>
    target.definition.nodes
      .filter((node) => node.type === triggerNodeType)
      .map((triggerNode) => ({ ...target, triggerNode })),
  )
}

export function triggerPublishedWorkflow({
  workflow,
  definition,
  triggerNodeId,
  triggerKind,
  input = {},
}: TriggerPublishedWorkflowOptions) {
  if (!workflow.activeVersion) {
    throw new Error(`Workflow ${workflow.id} does not have an active version`)
  }

  return workflowRunner.runWorkflow(
    workflow.id,
    workflow.userId,
    definition.nodes,
    definition.edges,
    {
      triggerNodeId,
      triggeredBy: triggerKind,
      workflowVersionId: workflow.activeVersion.id,
      definitionSnapshot: workflow.activeVersion.definition,
      source: 'published',
      workflowInput: input,
    },
  )
}
