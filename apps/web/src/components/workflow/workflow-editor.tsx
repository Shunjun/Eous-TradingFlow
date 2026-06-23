import { useEffect, useState, useCallback, useRef } from 'react'
import type { WorkflowEditOp, WorkflowNode } from '@eous/api-client'
import { api, ApiError } from '../../lib/api'
import {
  WorkflowStoreProvider,
  useWorkflowStore,
  useWorkflowStoreApi,
} from './store/workflow-store'
import { tryApplyWorkflowOpsToState } from './store/workflow-ops'
import { useWorkflow, publishWorkflow, saveWorkflow } from '../../hooks/use-workflows'
import { useWorkflowListStore } from '../../stores/workflows'
import { WorkflowCanvas, WorkflowOverlay } from './canvas'
import { useKeyboardShortcuts } from './hooks'
import {
  buildWorkflowDocument,
  isWorkflowNodeType,
  readWorkflowDraft,
  removeWorkflowDraft,
  toLocalWorkflowEdges,
  toLocalWorkflowNodes,
  writeWorkflowDraft,
  workflowContentOps,
} from './utils'
import { WorkflowSaveConflictDialog, type WorkflowSaveConflictState } from './dialogs'

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

  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [isLocalDraft, setIsLocalDraft] = useState(false)
  const [baseUpdatedAt, setBaseUpdatedAt] = useState<string | null>(null)
  const [conflict, setConflict] = useState<WorkflowSaveConflictState>(null)
  const [resolvingConflict, setResolvingConflict] = useState(false)
  const editorRef = useRef<HTMLDivElement | null>(null)
  const workflowNameRef = useRef(workflowName)
  const initialWorkflowNameRef = useRef<string | null>(null)

  useEffect(() => {
    workflowNameRef.current = workflowName
  }, [workflowName])

  useEffect(() => {
    if (!workflow) return

    const serverNodes = toLocalWorkflowNodes(workflow)
    const serverEdges = toLocalWorkflowEdges(workflow)

    const draft = readWorkflowDraft(workflow.id)
    const serverUpdated = new Date(workflow.updatedAt).getTime()
    setBaseUpdatedAt(workflow.updatedAt)
    initialWorkflowNameRef.current = workflow.name

    if (draft && draft.lastModified > serverUpdated) {
      loadDraftWorkflow(workflow.id, draft.name, draft.nodes, draft.edges, draft.pendingOps ?? [])
      setIsLocalDraft(true)
    } else {
      loadWorkflow(workflow.id, workflow.name, serverNodes, serverEdges)
      setIsLocalDraft(false)
      writeWorkflowDraft(workflow.id, {
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
        removeWorkflowDraft(workflowIdToSave)
        return api.getWorkflow(workflowIdToSave)
      }
      const result = await api.applyWorkflowOps(workflowIdToSave, {
        baseUpdatedAt: nextBaseUpdatedAt,
        ops: contentOps,
      })
      setBaseUpdatedAt(result.workflow.updatedAt)
      removeWorkflowDraft(workflowIdToSave)
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
      const serverNodes = toLocalWorkflowNodes(latestWorkflow)
      const serverEdges = toLocalWorkflowEdges(latestWorkflow)
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
        if (!n.type || !isWorkflowNodeType(n.type)) continue
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
      removeWorkflowDraft(activeWorkflowId)
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
      removeWorkflowDraft(activeWorkflowId)
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
    loadWorkflow(latest.id, latest.name, toLocalWorkflowNodes(latest), toLocalWorkflowEdges(latest))
    setBaseUpdatedAt(latest.updatedAt)
    removeWorkflowDraft(activeWorkflowId)
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
      writeWorkflowDraft(activeWorkflowId, {
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

  useKeyboardShortcuts({ targetRef: editorRef })

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-muted-foreground">加载中…</span>
      </div>
    )
  }

  return (
    <div
      ref={editorRef}
      className="relative h-full w-full overflow-hidden outline-none"
      tabIndex={-1}
      onPointerDown={() => editorRef.current?.focus()}
    >
      <WorkflowCanvas />
      <WorkflowOverlay
        workflowId={workflowId}
        saving={saving}
        publishing={publishing}
        isLocalDraft={isLocalDraft}
        showWorkflowList={showWorkflowList}
        onSave={handleSave}
        onPublish={handlePublish}
        onWorkflowSelect={onWorkflowSelect}
      />
      <WorkflowSaveConflictDialog
        conflict={conflict}
        resolving={resolvingConflict}
        onOpenChange={(open) => !open && setConflict(null)}
        onMerge={handleMergeConflict}
        onSaveAsCopy={handleSaveConflictAsCopy}
        onDiscard={handleDiscardConflict}
      />
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
