import { useCallback, useEffect, useState } from 'react'
import type { WorkflowDefinition } from '@eous/types'
import { api } from '../lib/api'

export function useWorkflowList() {
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listWorkflows()
      setWorkflows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflows')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

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

export async function saveWorkflow(
  workflow: WorkflowDefinition,
): Promise<void> {
  await api.saveWorkflow(workflow)
}

export async function createWorkflow(name: string): Promise<string> {
  const result = await api.createWorkflow({
    name,
    definition: '{"nodes":[],"edges":[]}',
  })
  return result.workflow.id
}

export async function publishWorkflow(id: string): Promise<void> {
  await fetch(`/api/workflows/${id}/publish`, { method: 'POST', credentials: 'include' })
}
