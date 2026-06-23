import { useCallback, useMemo } from 'react'
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
  type NodeChange,
  type EdgeChange,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  type NodeProps,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { nodeRegistry, type NodeComponentProps, type ParamDef } from '@eous/nodes'
import { api } from '../../../lib/api'
import { useWorkflowStore } from '../../../stores/workflow'
import { BaseNode } from '../nodes/base-node'
import type { CanvasInteractionMode } from './canvas-toolbar'
import { WORKFLOW_FIT_VIEW_OPTIONS, WORKFLOW_MAX_ZOOM } from './viewport'

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

function hasPersistableNodeChange(changes: NodeChange[]): boolean {
  return changes.some(
    (change) =>
      change.type === 'position' ||
      change.type === 'add' ||
      change.type === 'remove' ||
      change.type === 'replace',
  )
}

function hasPersistableEdgeChange(changes: EdgeChange[]): boolean {
  return changes.some(
    (change) => change.type === 'add' || change.type === 'remove' || change.type === 'replace',
  )
}

function createNodeComponent(
  CanvasNode: (props: NodeComponentProps) => React.ReactNode,
  options?: {
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
  },
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
  const onNodesChange = useWorkflowStore((s) => s.onNodesChange)
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange)
  const addNode = useWorkflowStore((s) => s.addNode)
  const removeNodes = useWorkflowStore((s) => s.removeNodes)

  const { screenToFlowPosition } = useReactFlow()

  const createWorkflowNode = useCallback((nodeType: string, position: { x: number; y: number }) => {
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
  }, [])

  const handleRunNode = useCallback((nodeId: string) => {
    const workflowId = useWorkflowStore.getState().activeWorkflowId
    if (!workflowId || workflowId === 'new') return
    void api.runWorkflowNode(workflowId, nodeId)
  }, [])

  const handleDuplicateNode = useCallback(
    (nodeId: string) => {
      const currentNodes = useWorkflowStore.getState().nodes
      const sourceNode = currentNodes.find((node) => node.id === nodeId)
      if (!sourceNode) return

      addNode({
        ...sourceNode,
        id: `${sourceNode.type ?? 'node'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        selected: false,
        position: {
          x: sourceNode.position.x + 32,
          y: sourceNode.position.y + 32,
        },
        data: { ...(sourceNode.data ?? {}) },
      })
    },
    [addNode],
  )

  const handleToggleLockNode = useCallback(
    (nodeId: string) => {
      const currentNodes = useWorkflowStore.getState().nodes
      onNodesChange(
        currentNodes.map((node) =>
          node.id === nodeId ? { ...node, draggable: node.draggable === false } : node,
        ),
      )
    },
    [onNodesChange],
  )

  const handleAddConnectedNode = useCallback(
    ({
      sourceNodeId,
      sourcePosition,
      nodeType,
    }: {
      sourceNodeId: string
      sourcePosition: 'left' | 'right'
      nodeType: string
    }) => {
      const currentNodes = useWorkflowStore.getState().nodes
      const sourceNode = currentNodes.find((node) => node.id === sourceNodeId)
      if (!sourceNode) return

      const xOffset = sourcePosition === 'right' ? 280 : -280
      const nextNode = createWorkflowNode(nodeType, {
        x: sourceNode.position.x + xOffset,
        y: sourceNode.position.y,
      })

      const currentEdges = useWorkflowStore.getState().edges
      const edge =
        sourcePosition === 'right'
          ? {
              id: `${sourceNodeId}-${nextNode.id}`,
              source: sourceNodeId,
              target: nextNode.id,
            }
          : {
              id: `${nextNode.id}-${sourceNodeId}`,
              source: nextNode.id,
              target: sourceNodeId,
            }

      onNodesChange([...currentNodes, nextNode])
      onEdgesChange(addEdge(edge, currentEdges))
    },
    [createWorkflowNode, onEdgesChange, onNodesChange],
  )

  const nodeTypes = useMemo<NodeTypes>(
    () =>
      Object.fromEntries(
        Object.entries(nodeRegistry).map(([type, entry]) => [
          type,
          createNodeComponent(entry.canvas as (props: NodeComponentProps) => React.ReactNode, {
            hideHandles: type === 'control.branch',
            onRun: handleRunNode,
            onToggleLock: handleToggleLockNode,
            onDuplicate: handleDuplicateNode,
            onDelete: (nodeId) => removeNodes([nodeId]),
            onAddConnectedNode: handleAddConnectedNode,
          }),
        ]),
      ),
    [handleAddConnectedNode, handleDuplicateNode, handleRunNode, handleToggleLockNode, removeNodes],
  )

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const currentNodes = useWorkflowStore.getState().nodes
      const nextNodes = applyNodeChanges(changes, currentNodes)
      if (hasPersistableNodeChange(changes)) {
        onNodesChange(nextNodes)
      } else {
        setNodes(nextNodes)
      }
    },
    [onNodesChange, setNodes],
  )

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      const currentEdges = useWorkflowStore.getState().edges
      const nextEdges = applyEdgeChanges(changes, currentEdges)
      if (hasPersistableEdgeChange(changes)) {
        onEdgesChange(nextEdges)
      } else {
        setEdges(nextEdges)
      }
    },
    [onEdgesChange, setEdges],
  )

  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const currentEdges = useWorkflowStore.getState().edges
      onEdgesChange(addEdge(connection, currentEdges))
    },
    [onEdgesChange],
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

      addNode(createWorkflowNode(nodeType, position))
    },
    [screenToFlowPosition, addNode, createWorkflowNode],
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
        fitViewOptions={WORKFLOW_FIT_VIEW_OPTIONS}
        maxZoom={WORKFLOW_MAX_ZOOM}
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
