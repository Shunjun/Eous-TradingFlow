import { MastraRuntime } from './mastra-runtime.js'
import type { AgentRuntime } from './types.js'

let runtime: AgentRuntime = new MastraRuntime()

export function getAgentRuntime(): AgentRuntime {
  return runtime
}

export function setAgentRuntime(nextRuntime: AgentRuntime): void {
  runtime = nextRuntime
}
