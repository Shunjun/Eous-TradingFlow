import { VariableRichField } from '../../variables/variable-rich-field'
import type { ParamDef } from '@eous/nodes'

interface TextareaFieldProps {
  param: ParamDef
  value: unknown
  onChange: (value: unknown) => void
  nodeId: string
  upstreamOutputs: Record<string, Record<string, unknown>>
}

function TextareaField({ param, value, onChange, nodeId, upstreamOutputs }: TextareaFieldProps) {
  return (
    <VariableRichField
      param={param}
      value={value}
      onChange={onChange}
      nodeId={nodeId}
      upstreamOutputs={upstreamOutputs}
      multiline
    />
  )
}

export { TextareaField }
