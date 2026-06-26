import { VariableRichField } from '../../variables/variable-rich-field'
import type { ParamDef } from '@eous/nodes'

interface TextFieldProps {
  param: ParamDef
  value: unknown
  onChange: (value: unknown) => void
  nodeId: string
  upstreamOutputs: Record<string, Record<string, unknown>>
}

function TextField({ param, value, onChange, nodeId, upstreamOutputs }: TextFieldProps) {
  return (
    <VariableRichField
      param={param}
      value={value}
      onChange={onChange}
      nodeId={nodeId}
      upstreamOutputs={upstreamOutputs}
    />
  )
}

export { TextField }
