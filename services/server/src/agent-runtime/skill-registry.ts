import { createTool } from '@mastra/core/tools'
import {
  defaultSkillManifests,
  type AgentSkill,
  type AgentSkillContext,
  type AgentSkillManifest,
} from '@eous/agent-skills'
import type { ToolsInput } from '@mastra/core/agent'
import { workflowCapability } from '../modules/workflow/workflow-capability.js'

export interface ResolveAgentToolsOptions extends AgentSkillContext {
  userId: string
  toolScope?: string[]
}

const serverCapabilities: Record<string, unknown> = {
  workflow: workflowCapability,
}

function resolveManifestCapabilities(manifest: AgentSkillManifest): Record<string, unknown> {
  const resolved: Record<string, unknown> = {}

  for (const capabilityId of manifest.requiredCapabilities ?? []) {
    const capability = serverCapabilities[capabilityId]
    if (!capability) {
      throw new Error(`Skill "${manifest.id}" requires capability "${capabilityId}"`)
    }
    resolved[capabilityId] = capability
  }

  return resolved
}

function createEnabledSkills(toolScope: string[] | undefined): AgentSkill[] {
  const enabledSkillIds = new Set(toolScope ?? [])
  return defaultSkillManifests
    .filter((manifest) => enabledSkillIds.has(manifest.id))
    .map((manifest) => manifest.createSkill(resolveManifestCapabilities(manifest)))
}

export function resolveAgentTools(options: ResolveAgentToolsOptions): ToolsInput {
  const tools: ToolsInput = {}

  for (const skill of createEnabledSkills(options.toolScope)) {
    for (const tool of skill.tools) {
      tools[tool.id] = createTool({
        id: tool.id,
        description: tool.description,
        inputSchema: tool.inputSchema,
        requireApproval: Boolean(tool.destructive),
        mcp: {
          annotations: {
            title: tool.id,
            readOnlyHint: Boolean(tool.readOnly),
            destructiveHint: Boolean(tool.destructive),
          },
          _meta: {
            skillId: skill.id,
            skillName: skill.name,
          },
        },
        execute: async (input) => tool.execute(options, input),
      })
    }
  }

  return tools
}
