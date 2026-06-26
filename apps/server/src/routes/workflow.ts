import { Hono } from 'hono'
import { authMiddleware } from '../lib/auth-middleware.js'
import * as workflowService from '../services/workflow.service.js'
import * as workflowEditService from '../services/workflow-edit.service.js'
import * as workflowRunner from '../services/workflow-runner.service.js'
import type { ApplyWorkflowOpsRequest } from '@eous/api-client'

export const workflowRouter = new Hono()

workflowRouter.use('*', authMiddleware)

workflowRouter.get('/', async (c) => {
  const workflows = await workflowService.listWorkflows(c.get('userId'))
  return c.json({ workflows })
})

workflowRouter.post('/', async (c) => {
  const body = await c.req.json<{
    name: string
    description?: string
    definition: string
  }>()
  const workflow = await workflowService.createWorkflow(c.get('userId'), body)
  return c.json({ workflow }, 201)
})

workflowRouter.get('/:id', async (c) => {
  const workflow = await workflowService.getWorkflow(c.get('userId'), c.req.param('id'))
  return c.json({ workflow })
})

workflowRouter.put('/:id', async (c) => {
  const body = await c.req.json<{
    name?: string
    description?: string
    definition?: string
  }>()
  const workflow = await workflowService.updateWorkflow(c.get('userId'), c.req.param('id'), body)
  return c.json({ workflow })
})

workflowRouter.patch('/:id/meta', async (c) => {
  const body = await c.req.json<{
    name?: string
    description?: string
  }>()
  const workflow = await workflowService.updateWorkflowMeta(
    c.get('userId'),
    c.req.param('id'),
    body,
  )
  return c.json({ workflow })
})

workflowRouter.patch('/:id', async (c) => {
  const body = await c.req.json<ApplyWorkflowOpsRequest>()
  const result = await workflowEditService.applyWorkflowOps(
    c.get('userId'),
    c.req.param('id'),
    body,
  )
  return c.json(result)
})

workflowRouter.post('/:id/events/batch', async (c) => {
  const body = await c.req.json<{
    baseSeq: number
    ops: ApplyWorkflowOpsRequest['ops']
    label?: string
    clientBatchId?: string
  }>()
  const result = await workflowEditService.applyWorkflowEvent(
    c.get('userId'),
    c.req.param('id'),
    body,
  )
  return c.json(result)
})

workflowRouter.get('/:id/history', async (c) => {
  const result = await workflowEditService.listWorkflowHistory(c.get('userId'), c.req.param('id'))
  return c.json(result)
})

workflowRouter.post('/:id/undo', async (c) => {
  const result = await workflowEditService.undoWorkflowEvent(c.get('userId'), c.req.param('id'))
  return c.json(result)
})

workflowRouter.post('/:id/redo', async (c) => {
  const result = await workflowEditService.redoWorkflowEvent(c.get('userId'), c.req.param('id'))
  return c.json(result)
})

workflowRouter.post('/:id/snapshots', async (c) => {
  const body = await c.req.json<{ name?: string }>().catch(() => ({}))
  const result = await workflowEditService.createWorkflowSnapshot(
    c.get('userId'),
    c.req.param('id'),
    body,
  )
  return c.json(result)
})

workflowRouter.get('/:id/snapshots', async (c) => {
  const result = await workflowEditService.listWorkflowSnapshots(c.get('userId'), c.req.param('id'))
  return c.json(result)
})

workflowRouter.post('/:id/snapshots/:eventId/restore', async (c) => {
  const result = await workflowEditService.restoreWorkflowSnapshot(
    c.get('userId'),
    c.req.param('id'),
    c.req.param('eventId'),
  )
  return c.json(result)
})

workflowRouter.delete('/:id', async (c) => {
  await workflowService.deleteWorkflow(c.get('userId'), c.req.param('id'))
  return c.json({ ok: true })
})

workflowRouter.post('/:id/publish', async (c) => {
  const version = await workflowService.publishWorkflow(c.get('userId'), c.req.param('id'))
  return c.json({ version })
})

workflowRouter.get('/:id/versions', async (c) => {
  const versions = await workflowService.listVersions(c.get('userId'), c.req.param('id'))
  return c.json({ versions })
})

// --- Node execution endpoints ---

function parseExecutionJson(exec: any) {
  if (!exec) return null
  return {
    ...exec,
    inputs: exec.inputs ? JSON.parse(exec.inputs) : null,
    outputs: exec.outputs ? JSON.parse(exec.outputs) : null,
    logs: exec.logs ? JSON.parse(exec.logs) : [],
  }
}

workflowRouter.post('/:id/nodes/:nodeId/run', async (c) => {
  const userId = c.get('userId')
  const workflow = await workflowService.getWorkflow(userId, c.req.param('id'))
  const def = JSON.parse(workflow.definition) as {
    nodes: Array<{ id: string; type: string; data: Record<string, unknown> }>
    edges: Array<{ id: string; source: string; target: string }>
  }
  const targetNode = def.nodes.find((n) => n.id === c.req.param('nodeId'))
  if (!targetNode) {
    return c.json({ error: 'Node not found' }, 404)
  }
  console.info('[workflow.run-node.route]', {
    workflowId: workflow.id,
    requestedNodeId: c.req.param('nodeId'),
    targetNode: { id: targetNode.id, type: targetNode.type },
    nodes: def.nodes.map((node) => ({ id: node.id, type: node.type })),
    edges: def.edges,
  })
  const result = await workflowRunner.runNode(workflow.id, userId, targetNode, def.nodes, def.edges)
  return c.json({
    execution: parseExecutionJson(result.targetExecution),
    executions: result.executions.map(parseExecutionJson),
  })
})

workflowRouter.get('/:id/nodes/:nodeId/last-execution', async (c) => {
  const execution = await workflowRunner.getLastExecution(c.req.param('id'), c.req.param('nodeId'))
  return c.json({ execution: parseExecutionJson(execution) })
})

workflowRouter.get('/:id/variables', async (c) => {
  const variables = await workflowRunner.getVariableCache(c.req.param('id'))
  return c.json({ variables })
})

workflowRouter.post('/:id/execute', async (c) => {
  const userId = c.get('userId')
  const workflow = await workflowService.getWorkflow(userId, c.req.param('id'))
  const body: { input?: Record<string, unknown> } = await c.req
    .json<{ input?: Record<string, unknown> }>()
    .catch(() => ({}))
  const def = JSON.parse(workflow.definition) as {
    nodes: Array<{ id: string; type: string; data: Record<string, unknown> }>
    edges: Array<{
      id: string
      source: string
      sourceHandle?: string
      target: string
      targetHandle?: string
    }>
  }
  const execution = await workflowRunner.runWorkflow(workflow.id, userId, def.nodes, def.edges, {
    workflowInput: body.input ?? {},
  })
  return c.json(execution)
})

workflowRouter.get('/:id/executions', async (c) => {
  const limit = Number(c.req.query('limit')) || 50
  const executions = await workflowRunner.getWorkflowExecutions(c.req.param('id'), limit)
  return c.json({ executions: executions.map(parseExecutionJson) })
})
