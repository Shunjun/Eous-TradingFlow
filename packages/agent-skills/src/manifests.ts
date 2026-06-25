import type { AgentSkillManifest } from './types.js'
import { webFetchSkillManifest } from './web-fetch/manifest.js'
import { workflowSkillManifest } from './workflow/manifest.js'

export const defaultSkillManifests: AgentSkillManifest[] = [
  workflowSkillManifest,
  webFetchSkillManifest,
]

export { webFetchSkillManifest, workflowSkillManifest }
