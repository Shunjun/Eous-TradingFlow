import type { BranchCondition } from '../../types'

export interface ExecuteInput {
  branches: BranchCondition[]
}

export interface ExecuteOutput {
  __selectedBranch: string
}
