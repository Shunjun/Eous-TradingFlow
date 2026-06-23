import type { Node, NodeProps } from '@xyflow/react'
import { nodeRegistry, type NodeComponentProps, type ParamDef } from '@eous/nodes'
import { BaseNode } from '../nodes/base-node'

interface WorkflowNodeData extends Record<string, unknown> {
  status?: 'idle' | 'running' | 'completed' | 'failed'
  color?: string
}

interface WorkflowNodeComponentOptions {
  hideHandles?: boolean
  onRun?: (id: string) => void
  onToggleLock?: (id: string) => void
  onDuplicate?: (id: string) => void
  onDelete?: (id: string) => void
  onAddConnectedNode?: (params: {
    sourceNodeId: string
    sourcePosition: 'left' | 'right'
    nodeType: string
  }) => void
}

function extractDefaults(input: Record<string, ParamDef>): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (const [key, def] of Object.entries(input)) {
    if (def.default !== undefined) data[key] = def.default
  }
  return data
}

const localNodeRegistry: Record<
  string,
  { defaults: Record<string, unknown>; label: string; color: string }
> = Object.fromEntries(
  Object.entries(nodeRegistry).map(([type, entry]) => [
    type,
    {
      defaults: extractDefaults(entry.def.executeInput),
      label: entry.def.meta.label,
      color: entry.def.meta.color,
    },
  ]),
)

function createWorkflowNode(nodeType: string, position: { x: number; y: number }) {
  const entry = localNodeRegistry[nodeType]
  return {
    id: `${nodeType}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: nodeType,
    position,
    data: {
      status: 'idle',
      label: entry?.label,
      color: entry?.color,
      ...entry?.defaults,
    },
  } satisfies Node<WorkflowNodeData>
}

function createNodeComponent(
  CanvasNode: (props: NodeComponentProps) => React.ReactNode,
  options?: WorkflowNodeComponentOptions,
) {
  return function WorkflowNode(props: NodeProps<Node<WorkflowNodeData>>) {
    return (
      <BaseNode
        id={props.id}
        data={props.data}
        selected={props.selected}
        locked={props.draggable === false}
        hideHandles={options?.hideHandles}
        onRun={options?.onRun}
        onToggleLock={options?.onToggleLock}
        onDuplicate={options?.onDuplicate}
        onDelete={options?.onDelete}
        onAddConnectedNode={options?.onAddConnectedNode}
      >
        <CanvasNode
          id={props.id}
          data={props.data}
          selected={props.selected}
          status={props.data.status}
        />
      </BaseNode>
    )
  }
}

export { createNodeComponent, createWorkflowNode }
export type { WorkflowNodeComponentOptions, WorkflowNodeData }
