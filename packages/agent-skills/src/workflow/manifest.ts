import type { AgentSkillManifest } from '../types.js'
import type { WorkflowCapability } from './capability.js'
import { createWorkflowSkill } from './scripts/workflow-skill.js'

export interface WorkflowSkillCapabilities extends Record<string, unknown> {
  workflow: WorkflowCapability
}

export const workflowSkillManifest: AgentSkillManifest = {
  id: 'workflow',
  name: 'Workflow',
  description: 'Inspect, edit, and run Eous workflows through structured operations.',
  requiredCapabilities: ['workflow'],
  createSkill(capabilities) {
    return createWorkflowSkill(capabilities.workflow as WorkflowCapability)
  },
}
