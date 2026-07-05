import type { AgentSkillManifest } from './types.js'
import { knowledgeSkillManifest } from './knowledge/manifest.js'
import { webFetchSkillManifest } from './web-fetch/manifest.js'
import { workflowSkillManifest } from './workflow/manifest.js'

export const defaultSkillManifests: AgentSkillManifest[] = [
  workflowSkillManifest,
  knowledgeSkillManifest,
  webFetchSkillManifest,
]

export { knowledgeSkillManifest, webFetchSkillManifest, workflowSkillManifest }
