import type { AgentSkillManifest } from '../types.js'
import { createWebFetchSkill } from './scripts/web-fetch-skill.js'

export const webFetchSkillManifest: AgentSkillManifest = {
  id: 'web_fetch',
  name: 'Web Fetch',
  description: 'Fetch and read content from a web URL.',
  createSkill() {
    return createWebFetchSkill()
  },
}
