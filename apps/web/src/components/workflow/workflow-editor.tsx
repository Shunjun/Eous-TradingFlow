import { useEffect, useState, useCallback, useRef } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { nodeRegistry } from '@eous/nodes'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@eous/ui'
import type {
  NodeType,
  WorkflowDefinition,
  WorkflowDefinitionDocument,
  WorkflowEditOp,
  WorkflowNode,
} from '@eous/api-client'
import { api, ApiError } from '../../lib/api'
import {
  WorkflowStoreProvider,
  useWorkflowStore,
  useWorkflowStoreApi,
} from './store/workflow-store'
import { toWorkflowEdge, toWorkflowNode, tryApplyWorkflowOpsToState } from './store/workflow-ops'
import { useWorkflow, publishWorkflow, saveWorkflow } from '../../hooks/use-workflows'
import { useWorkflowListStore } from '../../stores/workflows'
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
  nodes: Node[]
  edges: Edge[]
  name: string
  pendingOps?: WorkflowEditOp[]
  lastModified: number
}

type ConflictState = null | {
  latestWorkflow: WorkflowDefinition
  pendingOps: WorkflowEditOp[]
  canMerge: boolean
  reason?: string
  rebased?: {
    nodes: Node[]
    edges: Edge[]
    workflowName: string
  }
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

function toLocalNodes(workflow: WorkflowDefinition): Node[] {
  return workflow.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data,
    draggable: n.meta?.locked ? false : undefined,
  }))
}

function toLocalEdges(workflow: WorkflowDefinition): Edge[] {
  return workflow.edges.map((e) => ({
    id: e.id,
    source: e.source,
    sourceHandle: e.sourceHandle,
    target: e.target,
    targetHandle: e.targetHandle,
  }))
}

function buildWorkflowDocument(nodes: Node[], edges: Edge[]): WorkflowDefinitionDocument {
  return {
    schemaVersion: 1,
    nodes: nodes.flatMap((node) => {
      if (!node.type || !isNodeType(node.type)) return []
      return [toWorkflowNode(node)]
    }),
    edges: edges.map(toWorkflowEdge),
  }
}

function workflowContentOps(ops: WorkflowEditOp[]): WorkflowEditOp[] {
  return ops.filter((op) => op.type !== 'workflow.rename')
}

interface WorkflowEditorProps {
  workflowId: string
  showWorkflowList?: boolean
  onWorkflowSelect?: (workflowId: string | null) => void
}

function WorkflowEditorContent({
  workflowId,
  showWorkflowList,
  onWorkflowSelect,
}: WorkflowEditorProps) {
  const { workflow, loading } = useWorkflow(workflowId)
  const workflowStore = useWorkflowStoreApi()
  const loadWorkflow = useWorkflowStore((s) => s.loadWorkflow)
  const loadDraftWorkflow = useWorkflowStore((s) => s.loadDraft)
  const refreshWorkflowList = useWorkflowListStore((s) => s.refreshWorkflows)
  const createWorkflowInList = useWorkflowListStore((s) => s.createWorkflow)
  const reset = useWorkflowStore((s) => s.reset)
  const activeWorkflowId = useWorkflowStore((s) => s.activeWorkflowId)
  const workflowName = useWorkflowStore((s) => s.workflowName)
  const nodes = useWorkflowStore((s) => s.nodes)
  const edges = useWorkflowStore((s) => s.edges)
  const undo = useWorkflowStore((s) => s.undo)
  const redo = useWorkflowStore((s) => s.redo)

  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const selectedNodeIdRef = useRef<string | null>(null)
  const [isLocalDraft, setIsLocalDraft] = useState(false)
  const [baseUpdatedAt, setBaseUpdatedAt] = useState<string | null>(null)
  const [conflict, setConflict] = useState<ConflictState>(null)
  const [resolvingConflict, setResolvingConflict] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [canvasMode, setCanvasMode] = useState<CanvasInteractionMode>('pan')
  const canvasModeRef = useRef(canvasMode)
  const spacePanPreviousModeRef = useRef<CanvasInteractionMode | null>(null)
  const workflowNameRef = useRef(workflowName)
  const initialWorkflowNameRef = useRef<string | null>(null)

  useEffect(() => {
    workflowNameRef.current = workflowName
  }, [workflowName])

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

  const handleEditorKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isEditableTarget(event.target)) return
      const modKey = event.metaKey || event.ctrlKey
      if (!modKey || event.key.toLowerCase() !== 'z') return

      event.preventDefault()
      event.stopPropagation()
      if (event.shiftKey) {
        redo()
      } else {
        undo()
      }
    },
    [redo, undo],
  )

  useEffect(() => {
    if (!workflow) return

    const serverNodes = toLocalNodes(workflow)
    const serverEdges = toLocalEdges(workflow)

    const draft = readDraft(workflow.id)
    const serverUpdated = new Date(workflow.updatedAt).getTime()
    setBaseUpdatedAt(workflow.updatedAt)
    initialWorkflowNameRef.current = workflow.name

    if (draft && draft.lastModified > serverUpdated) {
      loadDraftWorkflow(workflow.id, draft.name, draft.nodes, draft.edges, draft.pendingOps ?? [])
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
  }, [workflow, loadDraftWorkflow, loadWorkflow, reset])

  useEffect(() => {
    if (!activeWorkflowId || !workflow || workflowName === initialWorkflowNameRef.current) return
    const trimmedName = workflowName.trim()
    if (!trimmedName) return

    const timeout = setTimeout(() => {
      void api
        .updateWorkflowMeta(activeWorkflowId, { name: trimmedName })
        .then(async ({ workflow: updatedWorkflow }) => {
          initialWorkflowNameRef.current = updatedWorkflow.name
          setBaseUpdatedAt(updatedWorkflow.updatedAt)
          if (workflowNameRef.current !== updatedWorkflow.name) {
            workflowStore.getState().setWorkflowName(updatedWorkflow.name)
          }
          await refreshWorkflowList()
        })
        .catch(() => {
          // error handled by global error handler
        })
    }, 600)

    return () => clearTimeout(timeout)
  }, [activeWorkflowId, refreshWorkflowList, workflow, workflowName, workflowStore])

  const savePendingOps = useCallback(
    async (workflowIdToSave: string, nextBaseUpdatedAt: string, pendingOps: WorkflowEditOp[]) => {
      const contentOps = workflowContentOps(pendingOps)
      if (contentOps.length === 0) {
        workflowStore.getState().markSynced()
        removeDraft(workflowIdToSave)
        return api.getWorkflow(workflowIdToSave)
      }
      const result = await api.applyWorkflowOps(workflowIdToSave, {
        baseUpdatedAt: nextBaseUpdatedAt,
        ops: contentOps,
      })
      setBaseUpdatedAt(result.workflow.updatedAt)
      removeDraft(workflowIdToSave)
      setIsLocalDraft(false)
      workflowStore.getState().markSynced()
      await refreshWorkflowList()
      return result.workflow
    },
    [refreshWorkflowList, workflowStore],
  )

  const openSaveConflict = useCallback(
    async (workflowIdToCheck: string, pendingOps: WorkflowEditOp[]) => {
      const contentOps = workflowContentOps(pendingOps)
      if (contentOps.length === 0) return
      const latestWorkflow = await api.getWorkflow(workflowIdToCheck)
      const serverNodes = toLocalNodes(latestWorkflow)
      const serverEdges = toLocalEdges(latestWorkflow)
      const dryRun = tryApplyWorkflowOpsToState(
        { nodes: serverNodes, edges: serverEdges, workflowName: latestWorkflow.name },
        contentOps,
      )

      if (dryRun.ok) {
        setConflict({
          latestWorkflow,
          pendingOps: contentOps,
          canMerge: true,
          rebased: {
            nodes: dryRun.nodes,
            edges: dryRun.edges,
            workflowName: dryRun.workflowName ?? latestWorkflow.name,
          },
        })
        return
      }

      setConflict({
        latestWorkflow,
        pendingOps: contentOps,
        canMerge: false,
        reason: dryRun.reason,
      })
    },
    [],
  )

  const handleSave = useCallback(async () => {
    if (!activeWorkflowId) return
    setSaving(true)
    try {
      const pendingOps = workflowContentOps(workflowStore.getState().pendingOps)
      if (pendingOps.length > 0 && baseUpdatedAt) {
        await savePendingOps(activeWorkflowId, baseUpdatedAt, pendingOps)
        return
      }

      const currentNodes = workflowStore.getState().nodes
      const currentEdges = workflowStore.getState().edges
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
      await refreshWorkflowList()
      workflowStore.getState().markClean()
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        const pendingOps = workflowContentOps(workflowStore.getState().pendingOps)
        if (pendingOps.length > 0) {
          await openSaveConflict(activeWorkflowId, pendingOps)
        }
      }
      // error handled by global error handler
    } finally {
      setSaving(false)
    }
  }, [
    activeWorkflowId,
    baseUpdatedAt,
    openSaveConflict,
    refreshWorkflowList,
    savePendingOps,
    workflowName,
    workflowStore,
  ])

  const handleMergeConflict = useCallback(async () => {
    if (!activeWorkflowId || !conflict?.canMerge || !conflict.rebased) return

    setResolvingConflict(true)
    try {
      loadDraftWorkflow(
        activeWorkflowId,
        conflict.rebased.workflowName,
        conflict.rebased.nodes,
        conflict.rebased.edges,
        conflict.pendingOps,
      )
      await savePendingOps(activeWorkflowId, conflict.latestWorkflow.updatedAt, conflict.pendingOps)
      setConflict(null)
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        await openSaveConflict(activeWorkflowId, conflict.pendingOps)
      }
    } finally {
      setResolvingConflict(false)
    }
  }, [activeWorkflowId, conflict, loadDraftWorkflow, openSaveConflict, savePendingOps])

  const handleSaveConflictAsCopy = useCallback(async () => {
    if (!activeWorkflowId) return

    setResolvingConflict(true)
    try {
      const current = workflowStore.getState()
      const definition = buildWorkflowDocument(current.nodes, current.edges)
      const workflow = await createWorkflowInList(
        `${current.workflowName || workflowName || '未命名工作流'} 副本`,
        JSON.stringify(definition),
      )
      removeDraft(activeWorkflowId)
      current.markSynced()
      setIsLocalDraft(false)
      setConflict(null)
      onWorkflowSelect?.(workflow.id)
    } finally {
      setResolvingConflict(false)
    }
  }, [activeWorkflowId, createWorkflowInList, onWorkflowSelect, workflowName, workflowStore])

  const handleDiscardConflict = useCallback(() => {
    if (!activeWorkflowId || !conflict) return

    const latest = conflict.latestWorkflow
    loadWorkflow(latest.id, latest.name, toLocalNodes(latest), toLocalEdges(latest))
    setBaseUpdatedAt(latest.updatedAt)
    removeDraft(activeWorkflowId)
    setIsLocalDraft(false)
    setConflict(null)
  }, [activeWorkflowId, conflict, loadWorkflow])

  const lastModified = useWorkflowStore((s) => s.lastModified)
  const debouncedDraftRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!activeWorkflowId || lastModified === 0) return

    if (debouncedDraftRef.current) clearTimeout(debouncedDraftRef.current)
    debouncedDraftRef.current = setTimeout(() => {
      const { nodes: latestNodes, edges: latestEdges, pendingOps } = workflowStore.getState()
      writeDraft(activeWorkflowId, {
        nodes: latestNodes,
        edges: latestEdges,
        name: workflowName,
        pendingOps: workflowContentOps(pendingOps),
        lastModified: Date.now(),
      })
    }, 2000)

    return () => {
      if (debouncedDraftRef.current) clearTimeout(debouncedDraftRef.current)
    }
  }, [activeWorkflowId, workflowName, lastModified, workflowStore])

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

  const handleAddNode = useCallback(
    (nodeType: string) => {
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
      workflowStore.getState().commitOps([{ type: 'node.add', node: newNode }], '添加节点')
    },
    [workflowStore],
  )

  const selectedNode = selectedNodeId ? (nodes.find((n) => n.id === selectedNodeId) ?? null) : null

  const handleNodeDataChange = useCallback(
    (data: Record<string, unknown>) => {
      const currentSelectedNodeId = selectedNodeIdRef.current
      if (!currentSelectedNodeId) return
      const store = workflowStore.getState()
      store.commitOps(
        [{ type: 'node.update', nodeId: currentSelectedNodeId, dataPatch: data }],
        '修改节点配置',
      )
    },
    [workflowStore],
  )

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
    <div
      className="relative h-full w-full overflow-hidden"
      tabIndex={-1}
      onKeyDown={handleEditorKeyDown}
    >
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
      <Dialog open={conflict !== null} onOpenChange={(open) => !open && setConflict(null)}>
        <DialogContent showCloseButton={!resolvingConflict}>
          <DialogHeader>
            <DialogTitle>{conflict?.canMerge ? '工作流已更新' : '无法自动合并'}</DialogTitle>
            <DialogDescription>
              {conflict?.canMerge
                ? '服务端版本已被修改。可以尝试把你的本地修改合并到最新版本，或保存为新的副本。'
                : `服务端版本已被修改，当前本地修改无法自动合并${
                    conflict?.reason ? `：${conflict.reason}` : ''
                  }。可以保存为新的副本，或丢弃本地修改并加载服务端版本。`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {conflict?.canMerge ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={resolvingConflict}
                  onClick={handleSaveConflictAsCopy}
                >
                  保存为副本
                </Button>
                <Button type="button" disabled={resolvingConflict} onClick={handleMergeConflict}>
                  合并修改
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={resolvingConflict}
                  onClick={handleDiscardConflict}
                >
                  丢弃本地修改
                </Button>
                <Button
                  type="button"
                  disabled={resolvingConflict}
                  onClick={handleSaveConflictAsCopy}
                >
                  保存为副本
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

WorkflowEditorContent.displayName = 'WorkflowEditorContent'

function WorkflowEditor(props: WorkflowEditorProps) {
  return (
    <WorkflowStoreProvider>
      <WorkflowEditorContent {...props} />
    </WorkflowStoreProvider>
  )
}

WorkflowEditor.displayName = 'WorkflowEditor'

export { WorkflowEditor }
export type { WorkflowEditorProps }
