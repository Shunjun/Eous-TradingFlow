import { z } from 'zod'

const workflowNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  data: z.record(z.string(), z.unknown()).default({}),
  meta: z
    .object({
      locked: z.boolean().optional(),
      createdBy: z.enum(['user', 'agent']).optional(),
      updatedBy: z.string().optional(),
    })
    .optional(),
})

const workflowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  sourceHandle: z.string().optional(),
  target: z.string(),
  targetHandle: z.string().optional(),
})

const workflowEditOpSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('workflow.rename'),
    name: z.string(),
    description: z.string().optional(),
  }),
  z.object({
    type: z.literal('node.add'),
    node: workflowNodeSchema,
  }),
  z.object({
    type: z.literal('node.update'),
    nodeId: z.string(),
    dataPatch: z.record(z.string(), z.unknown()).optional(),
    position: z.object({ x: z.number(), y: z.number() }).optional(),
    metaPatch: workflowNodeSchema.shape.meta,
    force: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('node.delete'),
    nodeId: z.string(),
    force: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('edge.add'),
    edge: workflowEdgeSchema,
  }),
  z.object({
    type: z.literal('edge.update'),
    edgeId: z.string(),
    patch: workflowEdgeSchema.partial(),
  }),
  z.object({
    type: z.literal('edge.delete'),
    edgeId: z.string(),
  }),
  z.object({
    type: z.literal('node.insertBetween'),
    edgeId: z.string(),
    node: workflowNodeSchema,
    sourceToNewEdge: workflowEdgeSchema.partial().optional(),
    newToTargetEdge: workflowEdgeSchema.partial().optional(),
  }),
])

export const workflowListInputSchema = z.object({
  query: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
})

export const workflowGetInputSchema = z.object({
  workflowId: z.string(),
})

export const workflowApplyOpsInputSchema = z.object({
  workflowId: z.string(),
  baseUpdatedAt: z.string().optional(),
  ops: z.array(workflowEditOpSchema).min(1),
})

export const workflowRunInputSchema = z.object({
  workflowId: z.string(),
  input: z.record(z.string(), z.unknown()).default({}),
})

export const workflowRunNodeInputSchema = z.object({
  workflowId: z.string(),
  nodeId: z.string(),
  input: z.record(z.string(), z.unknown()).default({}),
})

export const workflowVariablesInputSchema = z.object({
  workflowId: z.string(),
})

export const workflowExecutionsInputSchema = z.object({
  workflowId: z.string(),
  limit: z.number().int().min(1).max(100).default(20),
})

export type WorkflowListInput = z.infer<typeof workflowListInputSchema>
export type WorkflowGetInput = z.infer<typeof workflowGetInputSchema>
export type WorkflowApplyOpsInput = z.infer<typeof workflowApplyOpsInputSchema>
export type WorkflowRunInput = z.infer<typeof workflowRunInputSchema>
export type WorkflowRunNodeInput = z.infer<typeof workflowRunNodeInputSchema>
export type WorkflowVariablesInput = z.infer<typeof workflowVariablesInputSchema>
export type WorkflowExecutionsInput = z.infer<typeof workflowExecutionsInputSchema>
