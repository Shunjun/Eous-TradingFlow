import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  MiniMap,
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
import type { WorkflowEditOp } from '@eous/api-client'
import { nodeRegistry, type NodeComponentProps, type ParamDef } from '@eous/nodes'
import { api } from '../../../lib/api'
import { useWorkflowStore, useWorkflowStoreApi } from '../store/workflow-store'
import { toWorkflowEdge, toWorkflowNode } from '../store/workflow-ops'
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
  const workflowStore = useWorkflowStoreApi()
  const nodes = useWorkflowStore((s) => s.nodes)
  const edges = useWorkflowStore((s) => s.edges)
  const setNodes = useWorkflowStore((s) => s.setNodes)
  const setEdges = useWorkflowStore((s) => s.setEdges)
  const onNodesChange = useWorkflowStore((s) => s.onNodesChange)
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange)
  const commitOps = useWorkflowStore((s) => s.commitOps)

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

  const handleRunNode = useCallback(
    (nodeId: string) => {
      const workflowId = workflowStore.getState().activeWorkflowId
      if (!workflowId || workflowId === 'new') return
      void api.runWorkflowNode(workflowId, nodeId)
    },
    [workflowStore],
  )

  const handleDuplicateNode = useCallback(
    (nodeId: string) => {
      const currentNodes = workflowStore.getState().nodes
      const sourceNode = currentNodes.find((node) => node.id === nodeId)
      if (!sourceNode) return

      const nextNode = {
        ...sourceNode,
        id: `${sourceNode.type ?? 'node'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        selected: false,
        position: {
          x: sourceNode.position.x + 32,
          y: sourceNode.position.y + 32,
        },
        data: { ...(sourceNode.data ?? {}) },
      }
      commitOps([{ type: 'node.add', node: toWorkflowNode(nextNode) }], '复制节点')
    },
    [commitOps, workflowStore],
  )

  const handleToggleLockNode = useCallback(
    (nodeId: string) => {
      const node = workflowStore.getState().nodes.find((item) => item.id === nodeId)
      if (!node) return
      commitOps(
        [{ type: 'node.update', nodeId, metaPatch: { locked: node.draggable !== false } }],
        node.draggable === false ? '解锁节点' : '锁定节点',
      )
    },
    [commitOps, workflowStore],
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
      const currentNodes = workflowStore.getState().nodes
      const sourceNode = currentNodes.find((node) => node.id === sourceNodeId)
      if (!sourceNode) return

      const xOffset = sourcePosition === 'right' ? 280 : -280
      const nextNode = createWorkflowNode(nodeType, {
        x: sourceNode.position.x + xOffset,
        y: sourceNode.position.y,
      })

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
      const ops: WorkflowEditOp[] = [
        { type: 'node.add', node: toWorkflowNode(nextNode) },
        { type: 'edge.add', edge },
      ]
      commitOps(ops, '添加并连接节点')
    },
    [commitOps, createWorkflowNode, workflowStore],
  )

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      commitOps([{ type: 'node.delete', nodeId, force: true }], '删除节点')
    },
    [commitOps],
  )

  const handleDeleteNodes = useCallback(
    (nodeIds: string[]) => {
      commitOps(
        nodeIds.map((nodeId): WorkflowEditOp => ({ type: 'node.delete', nodeId, force: true })),
        '删除节点',
      )
    },
    [commitOps],
  )

  const handleDeleteEdges = useCallback(
    (edgeIds: string[]) => {
      commitOps(
        edgeIds.map((edgeId): WorkflowEditOp => ({ type: 'edge.delete', edgeId })),
        '删除连线',
      )
    },
    [commitOps],
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
            onDelete: handleDeleteNode,
            onAddConnectedNode: handleAddConnectedNode,
          }),
        ]),
      ),
    [
      handleAddConnectedNode,
      handleDeleteNode,
      handleDuplicateNode,
      handleRunNode,
      handleToggleLockNode,
    ],
  )

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const currentNodes = workflowStore.getState().nodes
      const nextNodes = applyNodeChanges(changes, currentNodes)
      if (hasPersistableNodeChange(changes)) {
        const ops: WorkflowEditOp[] = []
        for (const change of changes) {
          if (change.type === 'position' && change.position) {
            ops.push({ type: 'node.update', nodeId: change.id, position: change.position })
          } else if (change.type === 'remove') {
            ops.push({ type: 'node.delete', nodeId: change.id, force: true })
          } else if (change.type === 'add') {
            ops.push({ type: 'node.add', node: toWorkflowNode(change.item) })
          } else if (change.type === 'replace') {
            ops.push({ type: 'node.delete', nodeId: change.id, force: true })
            ops.push({ type: 'node.add', node: toWorkflowNode(change.item) })
          }
        }
        if (ops.length > 0) {
          commitOps(ops, '更新节点')
        } else {
          onNodesChange(nextNodes)
        }
      } else {
        setNodes(nextNodes)
      }
    },
    [commitOps, onNodesChange, setNodes, workflowStore],
  )

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      const currentEdges = workflowStore.getState().edges
      const nextEdges = applyEdgeChanges(changes, currentEdges)
      if (hasPersistableEdgeChange(changes)) {
        const ops: WorkflowEditOp[] = []
        for (const change of changes) {
          if (change.type === 'remove') {
            ops.push({ type: 'edge.delete', edgeId: change.id })
          } else if (change.type === 'add') {
            ops.push({ type: 'edge.add', edge: toWorkflowEdge(change.item) })
          } else if (change.type === 'replace') {
            ops.push({ type: 'edge.delete', edgeId: change.id })
            ops.push({ type: 'edge.add', edge: toWorkflowEdge(change.item) })
          }
        }
        if (ops.length > 0) {
          commitOps(ops, '更新连线')
        } else {
          onEdgesChange(nextEdges)
        }
      } else {
        setEdges(nextEdges)
      }
    },
    [commitOps, onEdgesChange, setEdges, workflowStore],
  )

  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const edge = {
        id: `${connection.source}-${connection.target}-${Date.now()}`,
        source: connection.source,
        sourceHandle: connection.sourceHandle ?? undefined,
        target: connection.target,
        targetHandle: connection.targetHandle ?? undefined,
      }
      commitOps([{ type: 'edge.add', edge }], '连接节点')
    },
    [commitOps],
  )

  const handleDelete = useCallback(
    (params: { nodes: Node[]; edges: Edge[] }) => {
      if (params.nodes.length > 0) {
        handleDeleteNodes(params.nodes.map((n) => n.id))
      } else if (params.edges.length > 0) {
        handleDeleteEdges(params.edges.map((edge) => edge.id))
      }
    },
    [handleDeleteEdges, handleDeleteNodes],
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

      commitOps(
        [{ type: 'node.add', node: toWorkflowNode(createWorkflowNode(nodeType, position)) }],
        '添加节点',
      )
    },
    [screenToFlowPosition, commitOps, createWorkflowNode],
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
