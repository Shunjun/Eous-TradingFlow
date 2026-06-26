import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkflowEditOp } from '@eous/api-client'
import { AppError } from '../lib/app-error'

const workflowRepo = vi.hoisted(() => ({
  workflow: {
    id: 'wf-1',
    userId: 'user-1',
    name: 'Workflow',
    description: '',
    definition: JSON.stringify({
      nodes: [
        {
          id: 'price-1',
          type: 'source.price',
          position: { x: 0, y: 0 },
          data: { label: 'Price', symbol: 'AAPL' },
        },
      ],
      edges: [],
    }),
    createdAt: new Date('2026-06-23T00:00:00.000Z'),
    updatedAt: new Date('2026-06-23T01:00:00.000Z'),
  },
  findById: vi.fn(),
  update: vi.fn(),
}))

vi.mock('../repositories/workflow.repo', () => ({
  findById: workflowRepo.findById,
  update: workflowRepo.update,
}))

async function importService() {
  return import('./workflow-edit.service')
}

function getWrittenDefinition() {
  const updateArg = workflowRepo.update.mock.calls.at(-1)?.[1] as { definition: string }
  return JSON.parse(updateArg.definition) as {
    nodes: Array<{ id: string; type: string; data: Record<string, unknown> }>
    edges: Array<{ id: string; source: string; target: string }>
  }
}

describe('workflow-edit.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    workflowRepo.findById.mockResolvedValue({ ...workflowRepo.workflow })
    workflowRepo.update.mockImplementation(async (_id, data) => ({
      ...workflowRepo.workflow,
      ...data,
      updatedAt: new Date('2026-06-23T02:00:00.000Z'),
    }))
  })

  it('adds a node using node registry defaults', async () => {
    const { applyWorkflowOps } = await importService()

    await applyWorkflowOps('user-1', 'wf-1', {
      ops: [
        {
          type: 'node.add',
          node: {
            id: 'kline-1',
            type: 'source.kline',
            position: { x: 100, y: 0 },
            data: { symbol: 'MSFT' },
          },
        },
      ],
    })

    const definition = getWrittenDefinition()
    const node = definition.nodes.find((item) => item.id === 'kline-1')
    expect(node?.data.label).toBe('K线数据')
    expect(node?.data.interval).toBe('1d')
    expect(node?.data.symbol).toBe('MSFT')
  })

  it('rejects adding a second start node', async () => {
    workflowRepo.findById.mockResolvedValue({
      ...workflowRepo.workflow,
      definition: JSON.stringify({
        nodes: [{ id: 'start', type: 'trigger.start', position: { x: 0, y: 0 }, data: {} }],
        edges: [],
      }),
    })
    const { applyWorkflowOps } = await importService()

    await expect(
      applyWorkflowOps('user-1', 'wf-1', {
        ops: [
          {
            type: 'node.add',
            node: { id: 'start-2', type: 'trigger.start', position: { x: 100, y: 0 }, data: {} },
          },
        ],
      }),
    ).rejects.toThrow('Workflow can only contain one start node')
  })

  it('allows replacing a start node in ordered ops', async () => {
    workflowRepo.findById.mockResolvedValue({
      ...workflowRepo.workflow,
      definition: JSON.stringify({
        nodes: [{ id: 'start', type: 'trigger.start', position: { x: 0, y: 0 }, data: {} }],
        edges: [],
      }),
    })
    const { applyWorkflowOps } = await importService()

    await applyWorkflowOps('user-1', 'wf-1', {
      ops: [
        { type: 'node.delete', nodeId: 'start', force: true },
        {
          type: 'node.add',
          node: { id: 'start-2', type: 'trigger.start', position: { x: 100, y: 0 }, data: {} },
        },
      ],
    })

    const definition = getWrittenDefinition()
    expect(definition.nodes.map((node) => node.id)).toEqual(['start-2'])
  })

  it('updates node data and returns warnings for unknown fields', async () => {
    const { applyWorkflowOps } = await importService()

    const result = await applyWorkflowOps('user-1', 'wf-1', {
      ops: [
        {
          type: 'node.update',
          nodeId: 'price-1',
          dataPatch: { symbol: 'TSLA', customField: true },
        },
      ],
    })

    const definition = getWrittenDefinition()
    expect(definition.nodes[0].data.symbol).toBe('TSLA')
    expect(result.warnings).toContain(
      'Unknown data field "customField" for node type "source.price"',
    )
  })

  it('deletes a node and connected edges', async () => {
    workflowRepo.findById.mockResolvedValue({
      ...workflowRepo.workflow,
      definition: JSON.stringify({
        nodes: [
          { id: 'a', type: 'source.price', position: { x: 0, y: 0 }, data: {} },
          { id: 'b', type: 'llm', position: { x: 100, y: 0 }, data: {} },
        ],
        edges: [{ id: 'a-b', source: 'a', target: 'b' }],
      }),
    })
    const { applyWorkflowOps } = await importService()

    await applyWorkflowOps('user-1', 'wf-1', { ops: [{ type: 'node.delete', nodeId: 'a' }] })

    const definition = getWrittenDefinition()
    expect(definition.nodes.map((node) => node.id)).toEqual(['b'])
    expect(definition.edges).toEqual([])
  })

  it('adds an edge and rejects cycles', async () => {
    workflowRepo.findById.mockResolvedValue({
      ...workflowRepo.workflow,
      definition: JSON.stringify({
        nodes: [
          { id: 'a', type: 'source.price', position: { x: 0, y: 0 }, data: {} },
          { id: 'b', type: 'llm', position: { x: 100, y: 0 }, data: {} },
        ],
        edges: [{ id: 'a-b', source: 'a', target: 'b' }],
      }),
    })
    const { applyWorkflowOps } = await importService()

    await expect(
      applyWorkflowOps('user-1', 'wf-1', {
        ops: [{ type: 'edge.add', edge: { id: 'b-a', source: 'b', target: 'a' } }],
      }),
    ).rejects.toThrow(/cycles/)
  })

  it('inserts a node between an existing edge', async () => {
    workflowRepo.findById.mockResolvedValue({
      ...workflowRepo.workflow,
      definition: JSON.stringify({
        nodes: [
          { id: 'a', type: 'source.price', position: { x: 0, y: 0 }, data: {} },
          { id: 'b', type: 'llm', position: { x: 100, y: 0 }, data: {} },
        ],
        edges: [{ id: 'a-b', source: 'a', target: 'b' }],
      }),
    })
    const { applyWorkflowOps } = await importService()

    await applyWorkflowOps('user-1', 'wf-1', {
      ops: [
        {
          type: 'node.insertBetween',
          edgeId: 'a-b',
          node: { id: 'branch-1', type: 'control.branch', position: { x: 50, y: 0 }, data: {} },
        },
      ],
    })

    const definition = getWrittenDefinition()
    expect(definition.edges).toEqual([
      { id: 'a-branch-1', source: 'a', target: 'branch-1' },
      { id: 'branch-1-b', source: 'branch-1', target: 'b' },
    ])
  })

  it('rejects inserting a second start node', async () => {
    workflowRepo.findById.mockResolvedValue({
      ...workflowRepo.workflow,
      definition: JSON.stringify({
        nodes: [
          { id: 'start', type: 'trigger.start', position: { x: 0, y: 0 }, data: {} },
          { id: 'a', type: 'source.price', position: { x: 100, y: 0 }, data: {} },
          { id: 'b', type: 'llm', position: { x: 200, y: 0 }, data: {} },
        ],
        edges: [{ id: 'a-b', source: 'a', target: 'b' }],
      }),
    })
    const { applyWorkflowOps } = await importService()

    await expect(
      applyWorkflowOps('user-1', 'wf-1', {
        ops: [
          {
            type: 'node.insertBetween',
            edgeId: 'a-b',
            node: { id: 'start-2', type: 'trigger.start', position: { x: 150, y: 0 }, data: {} },
          },
        ],
      }),
    ).rejects.toThrow('Workflow can only contain one start node')
  })

  it('rejects stale baseUpdatedAt', async () => {
    const { applyWorkflowOps } = await importService()

    await expect(
      applyWorkflowOps('user-1', 'wf-1', {
        baseUpdatedAt: '2026-06-23T00:00:00.000Z',
        ops: [{ type: 'workflow.rename', name: 'New name' }],
      }),
    ).rejects.toMatchObject(
      new AppError('Workflow has changed. Refresh before applying edits.', 409),
    )
  })

  it('persists workflow rename ops', async () => {
    const { applyWorkflowOps } = await importService()

    const result = await applyWorkflowOps('user-1', 'wf-1', {
      ops: [{ type: 'workflow.rename', name: 'Renamed workflow' }],
    })

    expect(workflowRepo.update).toHaveBeenCalledWith(
      'wf-1',
      expect.objectContaining({ name: 'Renamed workflow' }),
    )
    expect(result.workflow.name).toBe('Renamed workflow')
  })
})
