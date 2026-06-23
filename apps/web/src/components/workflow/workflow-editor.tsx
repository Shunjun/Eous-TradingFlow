import { useEffect, useState, useCallback, useRef } from 'react'
import { nodeRegistry } from '@eous/nodes'
import type { NodeType, WorkflowNode } from '@eous/api-client'
import { useWorkflowStore } from '../../stores/workflow'
import { useWorkflow, publishWorkflow, saveWorkflow } from '../../hooks/use-workflows'
import { WorkflowCanvas, WorkflowOverlay, type CanvasInteractionMode } from './canvas'

const VALID_NODE_TYPES = new Set<string>(Object.keys(nodeRegistry))

function isNodeType(value: string): value is NodeType {
  return VALID_NODE_TYPES.has(value)
}

const NODE_DEFAULTS: Record<string, Record<string, unknown>> = Object.fromEntries(
  Object.entries(nodeRegistry).map(([type, entry]) => [
    type,
    extractDefaults(entry.def.executeInput),
  ]),
)

const NODE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(nodeRegistry).map(([type, entry]) => [type, entry.def.meta.label]),
)

const NODE_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(nodeRegistry).map(([type, entry]) => [type, entry.def.meta.color]),
)

function extractDefaults(input: Record<string, { default?: unknown }>): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (const [key, def] of Object.entries(input)) {
    if (def.default !== undefined) {
      data[key] = def.default
    }
  }
  return data
}

interface LocalDraft {
  nodes: import('@xyflow/react').Node[]
  edges: import('@xyflow/react').Edge[]
  name: string
  lastModified: number
}

function draftKey(id: string): string {
  return `eous-wf-${id}`
}

function isLocalDraft(value: unknown): value is LocalDraft {
  if (typeof value !== 'object' || value === null) return false
  return (
    'nodes' in value &&
    Array.isArray(value.nodes) &&
    'edges' in value &&
    Array.isArray(value.edges) &&
    'name' in value &&
    typeof value.name === 'string' &&
    'lastModified' in value &&
    typeof value.lastModified === 'number'
  )
}

function readDraft(id: string): LocalDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(id))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isLocalDraft(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeDraft(id: string, draft: LocalDraft): void {
  try {
    localStorage.setItem(draftKey(id), JSON.stringify(draft))
  } catch {
    // quota exceeded — silently ignore
  }
}

function removeDraft(id: string): void {
  try {
    localStorage.removeItem(draftKey(id))
  } catch {
    // ignore
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

interface WorkflowEditorProps {
  workflowId: string
  showWorkflowList?: boolean
  onWorkflowSelect?: (workflowId: string) => void
}

function WorkflowEditor({ workflowId, showWorkflowList, onWorkflowSelect }: WorkflowEditorProps) {
  const { workflow, loading } = useWorkflow(workflowId)
  const loadWorkflow = useWorkflowStore((s) => s.loadWorkflow)
  const reset = useWorkflowStore((s) => s.reset)
  const activeWorkflowId = useWorkflowStore((s) => s.activeWorkflowId)
  const workflowName = useWorkflowStore((s) => s.workflowName)
  const nodes = useWorkflowStore((s) => s.nodes)
  const edges = useWorkflowStore((s) => s.edges)

  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const selectedNodeIdRef = useRef<string | null>(null)
  const [isLocalDraft, setIsLocalDraft] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [canvasMode, setCanvasMode] = useState<CanvasInteractionMode>('pan')
  const canvasModeRef = useRef(canvasMode)
  const spacePanPreviousModeRef = useRef<CanvasInteractionMode | null>(null)

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId
  }, [selectedNodeId])

  useEffect(() => {
    canvasModeRef.current = canvasMode
  }, [canvasMode])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || isEditableTarget(event.target)) return
      event.preventDefault()

      if (spacePanPreviousModeRef.current === null) {
        spacePanPreviousModeRef.current = canvasModeRef.current
      }
      setCanvasMode('pan')
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return

      const previousMode = spacePanPreviousModeRef.current
      if (previousMode === null) return

      event.preventDefault()
      spacePanPreviousModeRef.current = null
      setCanvasMode(previousMode)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useEffect(() => {
    if (!workflow) return

    const serverNodes = workflow.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
    }))
    const serverEdges = workflow.edges.map((e) => ({
      id: e.id,
      source: e.source,
      sourceHandle: e.sourceHandle,
      target: e.target,
      targetHandle: e.targetHandle,
    }))

    const draft = readDraft(workflow.id)
    const serverUpdated = new Date(workflow.updatedAt).getTime()

    if (draft && draft.lastModified > serverUpdated) {
      loadWorkflow(workflow.id, draft.name, draft.nodes, draft.edges)
      setIsLocalDraft(true)
    } else {
      loadWorkflow(workflow.id, workflow.name, serverNodes, serverEdges)
      setIsLocalDraft(false)
      writeDraft(workflow.id, {
        nodes: serverNodes,
        edges: serverEdges,
        name: workflow.name,
        lastModified: serverUpdated,
      })
    }

    return () => reset()
  }, [workflow, loadWorkflow, reset])

  const handleSave = useCallback(async () => {
    if (!activeWorkflowId) return
    setSaving(true)
    try {
      const currentNodes = useWorkflowStore.getState().nodes
      const currentEdges = useWorkflowStore.getState().edges
      const workflowNodes: WorkflowNode[] = []
      for (const n of currentNodes) {
        if (!n.type || !isNodeType(n.type)) continue
        workflowNodes.push({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data ?? {},
        })
      }

      await saveWorkflow({
        id: activeWorkflowId,
        name: workflowName,
        nodes: workflowNodes,
        edges: currentEdges.map((e) => ({
          id: e.id,
          source: e.source,
          sourceHandle: e.sourceHandle ?? '',
          target: e.target,
          targetHandle: e.targetHandle ?? '',
        })),
        createdAt: '',
        updatedAt: '',
      })
      removeDraft(activeWorkflowId)
      setIsLocalDraft(false)
      useWorkflowStore.getState().markClean()
    } catch {
      // error handled by global error handler
    } finally {
      setSaving(false)
    }
  }, [activeWorkflowId, workflowName])

  const lastModified = useWorkflowStore((s) => s.lastModified)
  const debouncedDraftRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!activeWorkflowId || lastModified === 0) return

    if (debouncedDraftRef.current) clearTimeout(debouncedDraftRef.current)
    debouncedDraftRef.current = setTimeout(() => {
      const { nodes: latestNodes, edges: latestEdges } = useWorkflowStore.getState()
      writeDraft(activeWorkflowId, {
        nodes: latestNodes,
        edges: latestEdges,
        name: workflowName,
        lastModified: Date.now(),
      })
    }, 2000)

    return () => {
      if (debouncedDraftRef.current) clearTimeout(debouncedDraftRef.current)
    }
  }, [activeWorkflowId, workflowName, lastModified])

  const handlePublish = useCallback(async () => {
    if (!activeWorkflowId) return
    setPublishing(true)
    try {
      await handleSave()
      await publishWorkflow(activeWorkflowId)
    } catch {
      // error handled by global error handler
    } finally {
      setPublishing(false)
    }
  }, [activeWorkflowId, handleSave])

  const handleAddNode = useCallback((nodeType: string) => {
    const entry = NODE_DEFAULTS[nodeType]
    const label = NODE_LABELS[nodeType] ?? nodeType
    const color = NODE_COLORS[nodeType]
    const newNode = {
      id: `${nodeType}-${Date.now()}`,
      type: nodeType,
      position: { x: 250 + Math.random() * 100, y: 150 + Math.random() * 100 },
      data: {
        status: 'idle' as const,
        label,
        color,
        ...entry,
      },
    }
    useWorkflowStore.getState().addNode(newNode)
  }, [])

  const selectedNode = selectedNodeId ? (nodes.find((n) => n.id === selectedNodeId) ?? null) : null

  const handleNodeDataChange = useCallback((data: Record<string, unknown>) => {
    const currentSelectedNodeId = selectedNodeIdRef.current
    if (!currentSelectedNodeId) return
    const store = useWorkflowStore.getState()
    store.setNodes(store.nodes.map((n) => (n.id === currentSelectedNodeId ? { ...n, data } : n)))
    store.markDirty()
  }, [])

  const handleCloseSettings = useCallback(() => {
    setSelectedNodeId(null)
  }, [])

  const handleToggleLog = useCallback(() => {
    setLogOpen((prev) => !prev)
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-muted-foreground">加载中…</span>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <WorkflowCanvas interactionMode={canvasMode} onSelectNode={setSelectedNodeId} />
      <WorkflowOverlay
        workflowId={workflowId}
        saving={saving}
        publishing={publishing}
        isLocalDraft={isLocalDraft}
        logOpen={logOpen}
        showWorkflowList={showWorkflowList}
        canvasMode={canvasMode}
        selectedNode={
          selectedNode
            ? {
                id: selectedNode.id,
                type: selectedNode.type,
                data: selectedNode.data ?? {},
              }
            : null
        }
        onSave={handleSave}
        onPublish={handlePublish}
        onToggleLog={handleToggleLog}
        onWorkflowSelect={onWorkflowSelect}
        onCanvasModeChange={setCanvasMode}
        onSelectNodeType={handleAddNode}
        onNodeDataChange={handleNodeDataChange}
        onCloseSettings={handleCloseSettings}
      />
    </div>
  )
}

WorkflowEditor.displayName = 'WorkflowEditor'

export { WorkflowEditor }
export type { WorkflowEditorProps }
