import { describe, expect, it } from 'vitest'
import type { WorkflowEditOp } from '@eous/api-client'
import {
  applyWorkflowOpsToState,
  invertWorkflowOps,
  tryApplyWorkflowOpsToState,
} from './workflow-ops'

const baseState = {
  workflowName: 'Original',
  nodes: [
    {
      id: 'a',
      type: 'source.price',
      position: { x: 0, y: 0 },
      data: { symbol: 'AAPL' },
    },
    {
      id: 'b',
      type: 'llm.free',
      position: { x: 200, y: 0 },
      data: { modelId: 'gpt' },
    },
  ],
  edges: [{ id: 'a-b', source: 'a', target: 'b' }],
}

describe('workflow ops', () => {
  it('applies and inverts node update ops', () => {
    const ops: WorkflowEditOp[] = [
      {
        type: 'node.update',
        nodeId: 'a',
        dataPatch: { symbol: 'MSFT' },
        position: { x: 10, y: 20 },
      },
    ]

    const inverse = invertWorkflowOps(baseState, ops)
    const next = applyWorkflowOpsToState(baseState, ops)
    const restored = applyWorkflowOpsToState(next, inverse)

    expect(next.nodes[0].data.symbol).toBe('MSFT')
    expect(next.nodes[0].position).toEqual({ x: 10, y: 20 })
    expect(restored.nodes[0].data.symbol).toBe('AAPL')
    expect(restored.nodes[0].position).toEqual({ x: 0, y: 0 })
  })

  it('applies and inverts workflow rename ops', () => {
    const ops: WorkflowEditOp[] = [{ type: 'workflow.rename', name: 'Renamed' }]

    const inverse = invertWorkflowOps(baseState, ops)
    const next = applyWorkflowOpsToState(baseState, ops)
    const restored = applyWorkflowOpsToState(next, inverse)

    expect(next.workflowName).toBe('Renamed')
    expect(restored.workflowName).toBe('Original')
  })

  it('restores connected edges when undoing node delete', () => {
    const ops: WorkflowEditOp[] = [{ type: 'node.delete', nodeId: 'a', force: true }]

    const inverse = invertWorkflowOps(baseState, ops)
    const next = applyWorkflowOpsToState(baseState, ops)
    const restored = applyWorkflowOpsToState(next, inverse)

    expect(next.nodes.map((node) => node.id)).toEqual(['b'])
    expect(next.edges).toEqual([])
    expect(restored.nodes.map((node) => node.id).sort()).toEqual(['a', 'b'])
    expect(restored.edges).toEqual([{ id: 'a-b', source: 'a', target: 'b' }])
  })

  it('applies and inverts insertBetween', () => {
    const ops: WorkflowEditOp[] = [
      {
        type: 'node.insertBetween',
        edgeId: 'a-b',
        node: {
          id: 'branch',
          type: 'control.branch',
          position: { x: 100, y: 0 },
          data: {},
        },
      },
    ]

    const inverse = invertWorkflowOps(baseState, ops)
    const next = applyWorkflowOpsToState(baseState, ops)
    const restored = applyWorkflowOpsToState(next, inverse)

    expect(next.edges).toEqual([
      {
        id: 'a-branch',
        source: 'a',
        sourceHandle: undefined,
        target: 'branch',
        targetHandle: undefined,
      },
      {
        id: 'branch-b',
        source: 'branch',
        sourceHandle: undefined,
        target: 'b',
        targetHandle: undefined,
      },
    ])
    expect(restored.nodes.map((node) => node.id).sort()).toEqual(['a', 'b'])
    expect(restored.edges).toEqual([{ id: 'a-b', source: 'a', target: 'b' }])
  })

  it('dry-runs mergeable ops', () => {
    const result = tryApplyWorkflowOpsToState(baseState, [
      { type: 'node.update', nodeId: 'a', dataPatch: { symbol: 'MSFT' } },
    ])

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.nodes[0].data.symbol).toBe('MSFT')
    }
  })

  it('dry-runs unmergeable ops', () => {
    const result = tryApplyWorkflowOpsToState(baseState, [
      { type: 'node.update', nodeId: 'missing', dataPatch: { symbol: 'MSFT' } },
    ])

    expect(result).toEqual({ ok: false, reason: '节点不存在: missing' })
  })
})
