export interface ExecuteInput {
  condition: string
  trueValue: unknown
  falseValue: unknown
}

export interface ExecuteOutput {
  result: boolean
  value: unknown
}
