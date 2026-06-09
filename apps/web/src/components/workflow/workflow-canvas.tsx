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
import {
  sourceKline,
  sourcePrice,
  controlBranch,
  type NodeComponentProps,
  type ParamDef,
} from '@eous/nodes'
import { useWorkflowStore } from '../../stores/workflow'
import { BaseNode } from './base-node'

function extractDefaults(input: Record<string, ParamDef>): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (const [key, def] of Object.entries(input)) {
    if (def.default !== undefined) {
      data[key] = def.default
    }
  }
  return data
}

const nodeRegistry: Record<string, { defaults: Record<string, unknown>; label: string; color: string }> = {
  'source.kline': {
    defaults: extractDefaults(sourceKline.def.executeInput),
    label: sourceKline.def.meta.label,
    color: sourceKline.def.meta.color,
  },
  'source.price': {
    defaults: extractDefaults(sourcePrice.def.executeInput),
    label: sourcePrice.def.meta.label,
    color: sourcePrice.def.meta.color,
  },
  'control.branch': {
    defaults: extractDefaults(controlBranch.def.executeInput),
    label: controlBranch.def.meta.label,
    color: controlBranch.def.meta.color,
  },
}

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

const nodeTypes: NodeTypes = {
  'source.kline': createNodeComponent(sourceKline.canvas, {
    hideHandles: false,
  }),
  'source.price': createNodeComponent(sourcePrice.canvas, {
    hideHandles: false,
  }),
  'control.branch': createNodeComponent(controlBranch.canvas, {
    hideHandles: true,
  }),
}

const defaultEdgeOptions = {
  animated: true,
  className: 'stroke-muted-foreground',
}

interface WorkflowCanvasProps {
  onSelectNode?: (nodeId: string | null) => void
}

function WorkflowCanvas({ onSelectNode }: WorkflowCanvasProps) {
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

      const entry = nodeRegistry[nodeType]
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
        fitView
        className="bg-background"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} className="opacity-30" />
        <MiniMap
          className="bg-card border-border text-foreground"
          nodeClassName="fill-muted-foreground/20"
        />
      </ReactFlow>
    </div>
  )
}

WorkflowCanvas.displayName = 'WorkflowCanvas'

export { WorkflowCanvas }
export type { WorkflowCanvasProps }
