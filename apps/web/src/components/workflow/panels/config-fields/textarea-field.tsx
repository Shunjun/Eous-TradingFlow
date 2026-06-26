import { forwardRef } from 'react'
import { Textarea } from '@eous/ui'
import type { ParamDef } from '@eous/nodes'

interface TextareaFieldProps {
  param: ParamDef
  value: unknown
  onChange: (value: unknown) => void
}

const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(function TextareaField(
  { param, value, onChange },
  ref,
) {
  return (
    <Textarea
      ref={ref}
      placeholder={param.placeholder}
      value={String(value ?? param.default ?? '')}
      className="min-h-24 resize-y bg-background text-xs"
      onChange={(event) => onChange(event.target.value)}
    />
  )
})

export { TextareaField }
