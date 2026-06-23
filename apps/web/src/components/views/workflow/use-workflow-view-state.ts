import { useCallback, useState } from 'react'
import type { ViewStateBridge } from '../types.js'

export interface WorkflowViewState {
  workflowId: string | null
}

export interface WorkflowViewProps {
  workflowId: string | null
  onWorkflowSelect: (workflowId: string | null) => void
}

const DEFAULT_WORKFLOW_STATE: WorkflowViewState = {
  workflowId: null,
}

export function createDefaultWorkflowViewState(): WorkflowViewState {
  return { ...DEFAULT_WORKFLOW_STATE }
}

export function normalizeWorkflowViewState(raw: unknown): WorkflowViewState {
  const value = raw as Partial<WorkflowViewState> | null | undefined
  return {
    workflowId: typeof value?.workflowId === 'string' ? value.workflowId : null,
  }
}

export function getWorkflowViewTitle(state: WorkflowViewState) {
  return state.workflowId ? 'Workflow' : 'Workflow'
}

export function useWorkflowViewState(
  initialState: unknown,
  onChange: (state: WorkflowViewState) => void,
): ViewStateBridge<WorkflowViewState, WorkflowViewProps> {
  const [state, setState] = useState<WorkflowViewState>(() =>
    normalizeWorkflowViewState(initialState),
  )

  const handleWorkflowSelect = useCallback(
    (workflowId: string | null) => {
      const updated = { workflowId }
      setState(updated)
      onChange(updated)
    },
    [onChange],
  )

  return {
    state,
    title: getWorkflowViewTitle(state),
    props: {
      workflowId: state.workflowId,
      onWorkflowSelect: handleWorkflowSelect,
    },
  }
}
