import { forwardRef } from 'react'
import { Input } from '@eous/ui'
import type { ParamDef } from '@eous/nodes'

interface TextFieldProps {
  param: ParamDef
  value: unknown
  onChange: (value: unknown) => void
}

const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { param, value, onChange },
  ref,
) {
  return (
    <Input
      ref={ref}
      size="sm"
      placeholder={param.placeholder}
      value={String(value ?? param.default ?? '')}
      onChange={(event) => onChange(event.target.value)}
    />
  )
})

export { TextField }
