import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../lib/api'

interface NodeExecution {
  id: string
  nodeId: string
  status: string
  inputs: Record<string, unknown> | null
  outputs: Record<string, unknown> | null
  logs: Array<{ ts: string; level: string; message: string }>
  durationMs: number | null
  error: string | null
}

function useNodeExecution(workflowId: string, nodeId: string) {
  const [running, setRunning] = useState(false)
  const [lastExecution, setLastExecution] = useState<NodeExecution | null>(null)
  const [loadingExecution, setLoadingExecution] = useState(true)
  const [upstreamOutputs, setUpstreamOutputs] = useState<Record<string, Record<string, unknown>>>(
    {},
  )

  const loadWorkflowVariables = useCallback(
    async (cancelled?: () => boolean) => {
      try {
        const res = await api.getWorkflowVariables(workflowId)
        if (!cancelled?.()) setUpstreamOutputs(res.variables)
      } catch {
        if (!cancelled?.()) setUpstreamOutputs({})
      }
    },
    [workflowId],
  )

  useEffect(() => {
    let cancelled = false
    void loadWorkflowVariables(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [loadWorkflowVariables])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingExecution(true)
      try {
        const res = await api.getNodeLastExecution(workflowId, nodeId)
        if (!cancelled) setLastExecution(res.execution)
      } catch {
        if (!cancelled) setLastExecution(null)
      } finally {
        if (!cancelled) setLoadingExecution(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [workflowId, nodeId])

  const runNode = useCallback(async () => {
    setRunning(true)
    try {
      const res = await api.runWorkflowNode(workflowId, nodeId)
      setLastExecution(res.execution)
      await loadWorkflowVariables()
    } catch {
      // error handled by global error handler
    } finally {
      setRunning(false)
    }
  }, [loadWorkflowVariables, nodeId, workflowId])

  return {
    running,
    lastExecution,
    loadingExecution,
    upstreamOutputs,
    runNode,
  }
}

export { useNodeExecution }
export type { NodeExecution }
