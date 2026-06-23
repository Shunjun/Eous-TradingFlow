import { useCallback, useMemo } from 'react'
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  type Node,
  type NodeTypes,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { nodeRegistry, type NodeComponentProps } from '@eous/nodes'
import { useWorkflowStore, useWorkflowStoreApi } from '../store/workflow-store'
import { toWorkflowNode } from '../store/workflow-ops'
import { WorkflowNodeSelectorPopover } from '../nodes'
import { WorkflowContextMenu } from './context-menu'
import { useWorkflowChangeHandlers, useWorkflowContextMenu, useWorkflowNodeActions } from '../hooks'
import { WORKFLOW_FIT_VIEW_OPTIONS, WORKFLOW_MAX_ZOOM } from './viewport'
import { createNodeComponent, createWorkflowNode } from './node-types'

const defaultEdgeOptions = {
  animated: true,
  className: 'stroke-muted-foreground',
}

function WorkflowCanvas() {
  const workflowStore = useWorkflowStoreApi()
  const nodes = useWorkflowStore((s) => s.nodes)
  const edges = useWorkflowStore((s) => s.edges)
  const setNodes = useWorkflowStore((s) => s.setNodes)
  const setEdges = useWorkflowStore((s) => s.setEdges)
  const onNodesChange = useWorkflowStore((s) => s.onNodesChange)
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange)
  const commitOps = useWorkflowStore((s) => s.commitOps)
  const interactionMode = useWorkflowStore((s) => s.canvasMode)
  const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId)

  const { fitView, screenToFlowPosition } = useReactFlow()
  const {
    contextMenu,
    contextMenuRef,
    nodeSelectorOpen,
    nodeSelectorPosition,
    closeContextMenu,
    openNodeSelector,
    handlePaneContextMenu,
    handleNodeContextMenu,
    handleNodeSelectorOpenChange,
  } = useWorkflowContextMenu({ screenToFlowPosition, onSelectNode: setSelectedNodeId })

  const {
    runNode: handleRunNode,
    duplicateNode: handleDuplicateNode,
    deleteNode: handleDeleteNode,
    deleteNodes: handleDeleteNodes,
    deleteEdges: handleDeleteEdges,
    toggleLockNode: handleToggleLockNode,
    addConnectedNode: handleAddConnectedNode,
  } = useWorkflowNodeActions({ workflowStore, commitOps, fitView })

  const { handleNodesChange, handleEdgesChange, handleConnect, handleDelete } =
    useWorkflowChangeHandlers({
      workflowStore,
      setNodes,
      setEdges,
      onNodesChange,
      onEdgesChange,
      commitOps,
      deleteNodes: handleDeleteNodes,
      deleteEdges: handleDeleteEdges,
    })

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
    [commitOps, screenToFlowPosition],
  )

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id)
    },
    [setSelectedNodeId],
  )

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null)
  }, [setSelectedNodeId])

  const handleSelectNodeFromMenu = useCallback(
    (nodeType: string) => {
      if (!nodeSelectorPosition) return
      commitOps(
        [
          {
            type: 'node.add',
            node: toWorkflowNode(createWorkflowNode(nodeType, nodeSelectorPosition.flowPosition)),
          },
        ],
        '添加节点',
      )
    },
    [commitOps, nodeSelectorPosition],
  )

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
        onPaneContextMenu={handlePaneContextMenu}
        onNodeContextMenu={handleNodeContextMenu}
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

      {contextMenu && (
        <WorkflowContextMenu
          menu={contextMenu}
          menuRef={contextMenuRef}
          onAddNode={() => openNodeSelector(contextMenu)}
          onClose={closeContextMenu}
        />
      )}

      {nodeSelectorPosition && (
        <WorkflowNodeSelectorPopover
          open={nodeSelectorOpen}
          position={nodeSelectorPosition}
          onOpenChange={handleNodeSelectorOpenChange}
          onSelectNode={handleSelectNodeFromMenu}
        />
      )}
    </div>
  )
}

WorkflowCanvas.displayName = 'WorkflowCanvas'

export { WorkflowCanvas }
