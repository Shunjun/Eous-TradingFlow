import type { ExecuteContext } from '../types'
import type { ExecuteInput, ExecuteOutput } from './types'

export async function execute(input: ExecuteInput, _ctx: ExecuteContext): Promise<ExecuteOutput> {
  const result = input.condition.includes('long')
  return {
    result,
    value: result ? input.trueValue : input.falseValue,
  }
}
