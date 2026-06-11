import { nodeRegistry } from './node-registry'

/** All registered server executors keyed by node type */
export const executors: Record<
  string,
  (
    input: Record<string, unknown>,
    ctx: import('../types').ExecuteContext,
  ) => Promise<Record<string, unknown>>
> = {}
for (const [type, entry] of Object.entries(nodeRegistry)) {
  executors[type] = entry.execute
}
