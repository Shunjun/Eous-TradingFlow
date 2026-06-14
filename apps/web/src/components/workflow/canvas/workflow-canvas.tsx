import { useCallback } from 'react'
import {
  ReactFlow,
  Background,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  BackgroundVariant,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  type NodeProps,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { nodeRegistry, type NodeComponentProps, type ParamDef } from '@eous/nodes'
import { useWorkflowStore } from '../../../stores/workflow'
import { BaseNode } from '../nodes/base-node'
import type { CanvasInteractionMode } from './canvas-toolbar'

function extractDefaults(input: Record<string, ParamDef>): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (const [key, def] of Object.entries(input)) {
    if (def.default !== undefined) {
      data[key] = def.default
    }
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

interface WorkflowNodeData extends Record<string, unknown> {
  status?: 'idle' | 'running' | 'completed' | 'failed'
  color?: string
}

function createNodeComponent(
  CanvasNode: (props: NodeComponentProps) => React.ReactNode,
  options?: { hideHandles?: boolean },
) {
  return function WorkflowNode(props: NodeProps<Node<WorkflowNodeData>>) {
    return (
      <BaseNode
        id={props.id}
        data={props.data}
        selected={props.selected}
        hideHandles={options?.hideHandles}
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

const nodeTypes: NodeTypes = Object.fromEntries(
  Object.entries(nodeRegistry).map(([type, entry]) => [
    type,
    createNodeComponent(entry.canvas as (props: NodeComponentProps) => React.ReactNode, {
      hideHandles: type === 'control.branch',
    }),
  ]),
)

const defaultEdgeOptions = {
  animated: true,
  className: 'stroke-muted-foreground',
}

interface WorkflowCanvasProps {
  interactionMode: CanvasInteractionMode
  onSelectNode?: (nodeId: string | null) => void
}

function WorkflowCanvas({ interactionMode, onSelectNode }: WorkflowCanvasProps) {
  const nodes = useWorkflowStore((s) => s.nodes)
  const edges = useWorkflowStore((s) => s.edges)
  const setNodes = useWorkflowStore((s) => s.setNodes)
  const setEdges = useWorkflowStore((s) => s.setEdges)
  const addNode = useWorkflowStore((s) => s.addNode)
  const removeNodes = useWorkflowStore((s) => s.removeNodes)

  const { screenToFlowPosition } = useReactFlow()

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const currentNodes = useWorkflowStore.getState().nodes
      setNodes(applyNodeChanges(changes, currentNodes))
    },
    [setNodes],
  )

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      const currentEdges = useWorkflowStore.getState().edges
      setEdges(applyEdgeChanges(changes, currentEdges))
    },
    [setEdges],
  )

  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const currentEdges = useWorkflowStore.getState().edges
      setEdges(addEdge(connection, currentEdges))
    },
    [setEdges],
  )

  const handleDelete = useCallback(
    (params: { nodes: Node[]; edges: Edge[] }) => {
      if (params.nodes.length > 0) {
        removeNodes(params.nodes.map((n) => n.id))
      }
    },
    [removeNodes],
  )

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const nodeType = event.dataTransfer.getData('application/eous-node-type')
      if (!nodeType) return

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const entry = localNodeRegistry[nodeType]
      const newNode: Node<WorkflowNodeData> = {
        id: `${nodeType}-${Date.now()}`,
        type: nodeType,
        position,
        data: {
          status: 'idle',
          label: entry?.label,
          color: entry?.color,
          ...entry?.defaults,
        },
      }

      addNode(newNode)
    },
    [screenToFlowPosition, addNode],
  )

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onSelectNode?.(node.id)
    },
    [onSelectNode],
  )

  const handlePaneClick = useCallback(() => {
    onSelectNode?.(null)
  }, [onSelectNode])

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onDelete={handleDelete}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        defaultEdgeOptions={defaultEdgeOptions}
        deleteKeyCode={['Backspace', 'Delete']}
        panOnDrag={interactionMode === 'pan'}
        selectionOnDrag={interactionMode === 'select'}
        selectionKeyCode={null}
        fitView
        className="bg-background [--xy-attribution-background-color:hsl(var(--card)/0.82)] [&_.react-flow__attribution]:rounded-tl-sm [&_.react-flow__attribution]:border-l [&_.react-flow__attribution]:border-t [&_.react-flow__attribution]:border-border [&_.react-flow__attribution]:backdrop-blur [&_.react-flow__attribution_a]:text-muted-foreground [&_.react-flow__attribution_a:hover]:text-foreground"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} className="opacity-30" />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          className="!m-3 overflow-hidden rounded-md border border-border bg-card/95 shadow-sm backdrop-blur"
          style={{ width: 128, height: 88 }}
          bgColor="hsl(var(--card))"
          maskColor="hsl(var(--background) / 0.58)"
          maskStrokeColor="hsl(var(--border))"
          maskStrokeWidth={1}
          nodeColor="hsl(var(--muted))"
          nodeStrokeColor="hsl(var(--muted-foreground))"
          nodeBorderRadius={4}
          nodeStrokeWidth={1}
        />
      </ReactFlow>
    </div>
  )
}

WorkflowCanvas.displayName = 'WorkflowCanvas'

export { WorkflowCanvas }
export type { WorkflowCanvasProps }
