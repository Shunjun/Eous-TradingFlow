import { forwardRef } from 'react'
import { Input } from '@eous/ui'
import type { ParamDef } from '@eous/nodes'

interface CodeFieldProps {
  param: ParamDef
  value: unknown
  onChange: (value: unknown) => void
}

const CodeField = forwardRef<HTMLInputElement, CodeFieldProps>(function CodeField(
  { param, value, onChange },
  ref,
) {
  return (
    <Input
      ref={ref}
      size="sm"
      placeholder={param.placeholder}
      value={String(value ?? param.default ?? '')}
      className="bg-muted/50 font-mono"
      onChange={(event) => onChange(event.target.value)}
    />
  )
})

export { CodeField }
