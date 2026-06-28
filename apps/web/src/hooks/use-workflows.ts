import { useEffect, useState } from 'react'
import type { WorkflowDefinition, WorkflowVersion } from '@eous/api-client'
import { api } from '../lib/api'
import { useWorkflowListStore } from '../stores/workflows'

export function useWorkflowList() {
  const workflows = useWorkflowListStore((s) => s.workflows)
  const loading = useWorkflowListStore((s) => s.loading)
  const error = useWorkflowListStore((s) => s.error)
  const loadWorkflows = useWorkflowListStore((s) => s.loadWorkflows)
  const refresh = useWorkflowListStore((s) => s.refreshWorkflows)

  useEffect(() => {
    void loadWorkflows()
  }, [loadWorkflows])

  return { workflows, loading, error, refresh }
}

export function useWorkflow(id: string | undefined) {
  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    api
      .getWorkflow(id)
      .then((data) => {
        if (!cancelled) {
          setWorkflow(data)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load workflow')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  return { workflow, loading, error }
}

export async function saveWorkflow(workflow: WorkflowDefinition): Promise<void> {
  await api.saveWorkflow(workflow)
}

export async function createWorkflow(name: string): Promise<string> {
  const workflow = await useWorkflowListStore.getState().createWorkflow(name)
  return workflow.id
}

export async function publishWorkflow(id: string): Promise<WorkflowVersion> {
  const result = await api.publishWorkflow(id)
  return result.version
}
