import type { z } from 'zod'
import type { AgentSkill, AgentSkillContext, AgentSkillTool } from '../../types.js'
import { webFetchUrlInputSchema, type WebFetchUrlInput } from '../schemas.js'
import type { WebFetchSkillDeps } from '../types.js'
import { fetchUrl as defaultFetchUrl } from './fetch-url.js'

function makeTool<TInput, TOutput>(
  tool: AgentSkillTool<TInput, TOutput>,
): AgentSkillTool<TInput, TOutput> {
  return tool
}

export function createWebFetchSkill(
  deps: WebFetchSkillDeps = { fetchUrl: defaultFetchUrl },
): AgentSkill {
  return {
    id: 'web_fetch',
    name: 'Web Fetch',
    description: 'Fetch and read content from a web URL.',
    tools: [
      makeTool({
        id: 'web_fetch_url',
        description:
          'Fetch a web page by URL and return readable text or raw HTML. Use this when the user provides a URL or asks to inspect a specific web page.',
        inputSchema: webFetchUrlInputSchema as z.ZodType<WebFetchUrlInput>,
        readOnly: true,
        async execute(_context: AgentSkillContext, input: WebFetchUrlInput) {
          return deps.fetchUrl(input)
        },
      }),
    ],
  }
}
