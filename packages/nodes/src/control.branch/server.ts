import type { ExecuteContext } from '../types'
import type { ExecuteInput, ExecuteOutput } from './types'

export async function execute(input: ExecuteInput, ctx: ExecuteContext): Promise<ExecuteOutput> {
  ctx.log('info', `评估条件: ${input.condition}`)

  let result: boolean
  try {
    const fn = new Function(`return (${input.condition})`)
    result = !!fn()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    ctx.log('error', `条件评估失败: ${msg}`)
    throw new Error(`条件评估失败: ${input.condition} — ${msg}`)
  }

  ctx.log('info', `条件结果: ${result}`)

  return {
    result,
    value: result ? input.trueValue : input.falseValue,
  }
}
