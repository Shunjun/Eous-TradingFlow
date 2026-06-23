import type { Node, NodeProps } from '@xyflow/react'
import { nodeRegistry, type NodeCanvasViewFactory, type ParamDef, type NodeDef } from '@eous/nodes'
import { BaseNode } from './base-node'
import { NodeCard } from './node-card'

interface WorkflowNodeData extends Record<string, unknown> {
  status?: 'idle' | 'running' | 'completed' | 'failed'
  color?: string
}

interface WorkflowNodeComponentOptions {
  connection?: NodeDef['connection']
  onRun?: (id: string) => void
  onToggleLock?: (id: string) => void
  onDuplicate?: (id: string) => void
  onDelete?: (id: string) => void
  onAddConnectedNode?: (params: {
    sourceNodeId: string
    sourceHandle: string
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
  getCanvasView: NodeCanvasViewFactory | undefined,
  nodeDef: NodeDef,
  options?: WorkflowNodeComponentOptions,
) {
  return function WorkflowNode(props: NodeProps<Node<WorkflowNodeData>>) {
    const view = getCanvasView?.({
      id: props.id,
      data: props.data,
      selected: props.selected,
      status: props.data.status,
    }) ?? {
      icon: nodeDef.meta.icon,
      title: typeof props.data.label === 'string' ? props.data.label : nodeDef.meta.label,
      color: typeof props.data.color === 'string' ? props.data.color : nodeDef.meta.color,
      rows: [],
    }

    return (
      <BaseNode
        id={props.id}
        data={props.data}
        selected={props.selected}
        locked={props.draggable === false}
        onRun={options?.onRun}
        onToggleLock={options?.onToggleLock}
        onDuplicate={options?.onDuplicate}
        onDelete={options?.onDelete}
      >
        <NodeCard
          nodeId={props.id}
          icon={view.icon}
          title={view.title}
          color={view.color}
          rows={view.rows}
          connection={options?.connection}
          onAddConnectedNode={options?.onAddConnectedNode}
        />
      </BaseNode>
    )
  }
}

export { createNodeComponent, createWorkflowNode }
export type { WorkflowNodeComponentOptions, WorkflowNodeData }
