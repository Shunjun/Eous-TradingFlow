import { useEffect, useState, useCallback, useRef } from 'react'
import type { WorkflowEditEvent, WorkflowEditOp } from '@eous/api-client'
import { api, ApiError } from '../../lib/api'
import {
  WorkflowStoreProvider,
  useWorkflowStore,
  useWorkflowStoreApi,
} from './store/workflow-store'
import { tryApplyWorkflowOpsToState } from './store/workflow-ops'
import type { WorkflowHistoryEntry } from './store/workflow-store'
import { useWorkflow, publishWorkflow } from '../../hooks/use-workflows'
import { useWorkflowListStore } from '../../stores/workflows'
import { useRecentWorkflowsStore } from '../../stores/recent-workflows'
import { PageLoading } from '../PageLoading'
import { WorkflowCanvas, WorkflowOverlay } from './canvas'
import { useKeyboardShortcuts } from './hooks'
import {
  buildWorkflowDocument,
  removeWorkflowDraft,
  toLocalWorkflowEdges,
  toLocalWorkflowNodes,
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
  const updateWorkflowInList = useWorkflowListStore((s) => s.updateWorkflow)
  const markRecentWorkflow = useRecentWorkflowsStore((s) => s.markRecent)
  const reset = useWorkflowStore((s) => s.reset)
  const activeWorkflowId = useWorkflowStore((s) => s.activeWorkflowId)
  const workflowName = useWorkflowStore((s) => s.workflowName)

  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [currentSeq, setCurrentSeq] = useState(0)
  const [publishedVersionId, setPublishedVersionId] = useState<string | null>(null)
  const currentSeqRef = useRef(0)
  const [snapshots, setSnapshots] = useState<WorkflowEditEvent[]>([])
  const [conflict, setConflict] = useState<WorkflowSaveConflictState>(null)
  const [resolvingConflict, setResolvingConflict] = useState(false)
  const editorRef = useRef<HTMLDivElement | null>(null)
  const workflowNameRef = useRef(workflowName)
  const initialWorkflowNameRef = useRef<string | null>(null)

  useEffect(() => {
    workflowNameRef.current = workflowName
  }, [workflowName])

  useEffect(() => {
    currentSeqRef.current = currentSeq
  }, [currentSeq])

  const loadSnapshots = useCallback(async (workflowIdToLoad: string) => {
    const res = await api.listWorkflowSnapshots(workflowIdToLoad)
    setSnapshots(res.snapshots)
  }, [])

  const buildHistoryEntries = useCallback((events: WorkflowEditEvent[]): WorkflowHistoryEntry[] => {
    const bySeq = new Map(events.map((event) => [event.seq, event]))
    const stack: WorkflowEditEvent[] = []

    for (const event of events) {
      if (event.kind === 'op' || event.kind === 'redo') {
        const target = event.kind === 'redo' && event.targetSeq ? bySeq.get(event.targetSeq) : event
        if (target) stack.push(target)
      } else if (event.kind === 'undo' && event.targetSeq) {
        const idx = stack.findIndex((item) => item.seq === event.targetSeq)
        if (idx >= 0) stack.splice(idx, 1)
      } else if (event.kind === 'restore') {
        stack.length = 0
      }
    }

    return stack.map((event) => ({
      id: event.id,
      label: event.label ?? event.kind,
      ops: event.ops,
      inverseOps: event.inverseOps,
      createdAt: new Date(event.createdAt).getTime(),
    }))
  }, [])

  useEffect(() => {
    if (!workflow) return

    const serverNodes = toLocalWorkflowNodes(workflow)
    const serverEdges = toLocalWorkflowEdges(workflow)

    setCurrentSeq(workflow.currentSeq)
    setPublishedVersionId(workflow.activeVersionId ?? null)
    initialWorkflowNameRef.current = workflow.name
    markRecentWorkflow({ id: workflow.id, name: workflow.name, updatedAt: workflow.updatedAt })

    loadWorkflow(workflow.id, workflow.name, serverNodes, serverEdges)
    void api.getWorkflowHistory(workflow.id).then((history) => {
      workflowStore.getState().setHistoryEntries(buildHistoryEntries(history.events))
    })
    void loadSnapshots(workflow.id)

    return () => reset()
  }, [
    buildHistoryEntries,
    loadSnapshots,
    loadWorkflow,
    markRecentWorkflow,
    reset,
    workflow,
    workflowStore,
  ])

  useEffect(() => {
    if (!activeWorkflowId || !workflow || workflowName === initialWorkflowNameRef.current) return
    const trimmedName = workflowName.trim()
    if (!trimmedName) return

    const timeout = setTimeout(() => {
      void api
        .updateWorkflowMeta(activeWorkflowId, { name: trimmedName })
        .then(async ({ workflow: updatedWorkflow }) => {
          initialWorkflowNameRef.current = updatedWorkflow.name
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

  const flushPendingOps = useCallback(
    async (label = '自动保存') => {
      const workflowIdToSave = workflowStore.getState().activeWorkflowId
      if (!workflowIdToSave || workflowIdToSave === 'new') return null
      const pendingOps = workflowContentOps(workflowStore.getState().pendingOps)
      const contentOps = workflowContentOps(pendingOps)
      if (contentOps.length === 0) return api.getWorkflow(workflowIdToSave)

      setSaving(true)
      try {
        const result = await api.applyWorkflowEvent(workflowIdToSave, {
          baseSeq: currentSeqRef.current,
          label,
          clientBatchId: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          ops: contentOps,
        })
        setCurrentSeq(result.workflow.currentSeq)
        workflowStore.getState().markSynced()
        removeWorkflowDraft(workflowIdToSave)
        await refreshWorkflowList()
        return result.workflow
      } finally {
        setSaving(false)
      }
    },
    [refreshWorkflowList, workflowStore],
  )

  const savePendingOps = useCallback(
    async (workflowIdToSave: string, _nextBaseUpdatedAt: string, pendingOps: WorkflowEditOp[]) => {
      const contentOps = workflowContentOps(pendingOps)
      if (contentOps.length === 0) {
        workflowStore.getState().markSynced()
        return api.getWorkflow(workflowIdToSave)
      }
      const result = await api.applyWorkflowEvent(workflowIdToSave, {
        baseSeq: currentSeqRef.current,
        ops: contentOps,
        label: '合并保存',
      })
      setCurrentSeq(result.workflow.currentSeq)
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
    try {
      await flushPendingOps('手动同步')
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        const pendingOps = workflowContentOps(workflowStore.getState().pendingOps)
        if (pendingOps.length > 0) {
          await openSaveConflict(activeWorkflowId!, pendingOps)
        }
      }
    }
  }, [activeWorkflowId, flushPendingOps, openSaveConflict, workflowStore])

  const handleMergeConflict = useCallback(async () => {
    if (!activeWorkflowId || !conflict?.canMerge || !conflict.rebased) return

    setResolvingConflict(true)
    try {
      currentSeqRef.current = conflict.latestWorkflow.currentSeq
      setCurrentSeq(conflict.latestWorkflow.currentSeq)
      loadDraftWorkflow(
        activeWorkflowId,
        conflict.rebased.workflowName,
        conflict.rebased.nodes,
        conflict.rebased.edges,
        conflict.pendingOps,
      )
      await savePendingOps(activeWorkflowId, '', conflict.pendingOps)
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
      await flushPendingOps('保存副本前同步')
      const current = workflowStore.getState()
      const definition = buildWorkflowDocument(current.nodes, current.edges)
      const workflow = await createWorkflowInList(
        `${current.workflowName || workflowName || '未命名工作流'} 副本`,
        JSON.stringify(definition),
      )
      removeWorkflowDraft(activeWorkflowId)
      current.markSynced()
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
    setCurrentSeq(latest.currentSeq)
    removeWorkflowDraft(activeWorkflowId)
    setConflict(null)
  }, [activeWorkflowId, conflict, loadWorkflow])

  const lastModified = useWorkflowStore((s) => s.lastModified)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!activeWorkflowId || lastModified === 0) return

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(() => {
      void flushPendingOps().catch(async (error) => {
        if (error instanceof ApiError && error.status === 409 && activeWorkflowId) {
          const pendingOps = workflowContentOps(workflowStore.getState().pendingOps)
          if (pendingOps.length > 0) await openSaveConflict(activeWorkflowId, pendingOps)
        }
      })
    }, 5000)

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    }
  }, [activeWorkflowId, flushPendingOps, lastModified, openSaveConflict, workflowStore])

  useEffect(() => {
    const handler = () => {
      void flushPendingOps('离开前同步')
    }
    window.addEventListener('pagehide', handler)
    return () => window.removeEventListener('pagehide', handler)
  }, [flushPendingOps])

  const handlePublish = useCallback(async () => {
    if (!activeWorkflowId) return
    setPublishing(true)
    try {
      await flushPendingOps('发布前同步')
      const version = await publishWorkflow(activeWorkflowId)
      setPublishedVersionId(version.id)
      updateWorkflowInList(activeWorkflowId, { activeVersionId: version.id })
    } catch {
      // error handled by global error handler
    } finally {
      setPublishing(false)
    }
  }, [activeWorkflowId, flushPendingOps, updateWorkflowInList])

  const handleCreateSnapshot = useCallback(async () => {
    if (!activeWorkflowId) return
    await flushPendingOps('快照前同步')
    const res = await api.createWorkflowSnapshot(activeWorkflowId, {
      name: `快照 ${new Date().toLocaleString()}`,
    })
    setCurrentSeq(res.workflow.currentSeq)
    await loadSnapshots(activeWorkflowId)
  }, [activeWorkflowId, flushPendingOps, loadSnapshots])

  const handleRestoreSnapshot = useCallback(
    async (eventId: string) => {
      if (!activeWorkflowId) return
      await flushPendingOps('恢复快照前同步')
      const res = await api.restoreWorkflowSnapshot(activeWorkflowId, eventId)
      setCurrentSeq(res.workflow.currentSeq)
      loadWorkflow(
        res.workflow.id,
        res.workflow.name,
        toLocalWorkflowNodes(res.workflow),
        toLocalWorkflowEdges(res.workflow),
      )
      await loadSnapshots(activeWorkflowId)
    },
    [activeWorkflowId, flushPendingOps, loadSnapshots, loadWorkflow],
  )

  useKeyboardShortcuts({ targetRef: editorRef })

  if (loading) {
    return <PageLoading label="Loading workflow..." />
  }

  return (
    <div
      ref={editorRef}
      className="relative h-full w-full overflow-hidden outline-none"
      tabIndex={-1}
      onPointerDown={() => editorRef.current?.focus()}
    >
      <WorkflowCanvas onBeforeRun={() => flushPendingOps('运行前同步')} />
      <WorkflowOverlay
        workflowId={workflowId}
        saving={saving}
        publishing={publishing}
        isPublished={publishedVersionId !== null}
        snapshots={snapshots}
        showWorkflowList={showWorkflowList}
        onPublish={handlePublish}
        onBeforeRun={() => flushPendingOps('运行前同步')}
        onCreateSnapshot={handleCreateSnapshot}
        onRestoreSnapshot={handleRestoreSnapshot}
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
