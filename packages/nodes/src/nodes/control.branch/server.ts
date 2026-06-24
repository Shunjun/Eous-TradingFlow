import type { ExecuteContext } from '../../types'
import type { ExecuteInput, ExecuteOutput } from './types'

export async function execute(input: ExecuteInput, ctx: ExecuteContext): Promise<ExecuteOutput> {
  const branches = Array.isArray(input.branches) ? input.branches : []

  for (const branch of branches) {
    if (branch.type === 'else') {
      ctx.log('info', `命中默认分支: ${branch.id}`)
      return { __selectedBranch: branch.id }
    }

    const condition = branch.condition ?? ''
    ctx.log('info', `评估分支 ${branch.id}: ${condition}`)

    try {
      const fn = new Function(`return (${condition})`)
      if (!!fn()) {
        ctx.log('info', `命中条件分支: ${branch.id}`)
        return { __selectedBranch: branch.id }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      ctx.log('error', `条件评估失败: ${msg}`)
      throw new Error(`条件评估失败: ${condition} — ${msg}`)
    }
  }

  ctx.log('info', '没有命中任何分支')
  return { __selectedBranch: '' }
}
