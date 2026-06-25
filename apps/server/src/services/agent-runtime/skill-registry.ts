import { createTool } from '@mastra/core/tools'
import { createWorkflowSkill, type AgentSkill, type AgentSkillContext } from '@eous/agent-skills'
import type { ToolsInput } from '@mastra/core/agent'
import * as workflowService from '../workflow.service.js'
import * as workflowEditService from '../workflow-edit.service.js'
import * as workflowRunner from '../workflow-runner.service.js'

export interface ResolveAgentToolsOptions extends AgentSkillContext {
  userId: string
  toolScope?: string[]
}

function createEnabledSkills(toolScope: string[] | undefined): AgentSkill[] {
  const enabled = new Set(toolScope ?? [])
  const skills: AgentSkill[] = []

  if (enabled.has('workflow')) {
    skills.push(
      createWorkflowSkill({
        listWorkflows: workflowService.listWorkflows,
        getWorkflow: workflowService.getWorkflow,
        applyWorkflowOps: workflowEditService.applyWorkflowOps,
        runWorkflow: workflowRunner.runWorkflow,
        runNode: workflowRunner.runNode,
        getVariableCache: workflowRunner.getVariableCache,
        getWorkflowExecutions: workflowRunner.getWorkflowExecutions,
      }),
    )
  }

  return skills
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
