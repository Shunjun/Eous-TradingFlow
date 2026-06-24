import type { ExecuteContext } from '../../types'
import type { ExecuteInput, ExecuteOutput } from './types'

async function execute(_input: ExecuteInput, ctx: ExecuteContext): Promise<ExecuteOutput> {
  const userInput = ctx.workflowInput?.userInput

  return {
    userInput: typeof userInput === 'string' ? userInput : '',
    triggeredAt: new Date().toISOString(),
  }
}

export { execute }
