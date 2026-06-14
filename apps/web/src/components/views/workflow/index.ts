import { GitBranch } from 'lucide-react'
import type { ViewRegistryEntry } from '../types.js'
import { WorkflowView } from './workflow-view.js'
import {
  createDefaultWorkflowViewState,
  useWorkflowViewState,
  type WorkflowViewProps,
  type WorkflowViewState,
} from './use-workflow-view-state.js'

export { WorkflowView } from './workflow-view.js'
export {
  createDefaultWorkflowViewState,
  getWorkflowViewTitle,
  normalizeWorkflowViewState,
  useWorkflowViewState,
  type WorkflowViewProps,
  type WorkflowViewState,
} from './use-workflow-view-state.js'

export const workflowViewEntry: ViewRegistryEntry<WorkflowViewState, WorkflowViewProps> = {
  type: 'workflow',
  label: 'Workflow',
  icon: GitBranch,
  Component: WorkflowView,
  useViewState: useWorkflowViewState,
  createDefaultState: createDefaultWorkflowViewState,
}
