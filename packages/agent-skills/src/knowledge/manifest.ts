import type { AgentSkillManifest } from '../types.js'
import type { KnowledgeCapability } from './capability.js'
import { createKnowledgeSkill } from './scripts/knowledge-skill.js'

export interface KnowledgeSkillCapabilities extends Record<string, unknown> {
  knowledge: KnowledgeCapability
}

export const knowledgeSkillManifest: AgentSkillManifest = {
  id: 'knowledge',
  name: 'Knowledge Base',
  description: 'List and retrieve Eous knowledge base context.',
  requiredCapabilities: ['knowledge'],
  createSkill(capabilities) {
    return createKnowledgeSkill(capabilities.knowledge as KnowledgeCapability)
  },
}
