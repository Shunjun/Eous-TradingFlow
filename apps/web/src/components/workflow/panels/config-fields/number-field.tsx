import { forwardRef, useEffect, useRef, useState } from 'react'
import { Input } from '@eous/ui'
import type { ParamDef } from '@eous/nodes'

interface NumberFieldProps {
  param: ParamDef
  value: unknown
  onChange: (value: unknown) => void
}

const NUMBER_DRAFT_PATTERN = /^-?\d*(\.\d*)?$/

const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(function NumberField(
  { param, value, onChange },
  ref,
) {
  const externalValue =
    value !== undefined ? String(value) : param.default !== undefined ? String(param.default) : ''
  const [draftValue, setDraftValue] = useState(externalValue)
  const lastExternalValueRef = useRef(externalValue)

  useEffect(() => {
    if (lastExternalValueRef.current === externalValue) return
    lastExternalValueRef.current = externalValue
    setDraftValue(externalValue)
  }, [externalValue])

  return (
    <Input
      ref={ref}
      size="sm"
      type="text"
      inputMode="decimal"
      pattern="[0-9]*"
      placeholder={param.placeholder}
      value={draftValue}
      onChange={(event) => {
        const nextValue = event.target.value
        if (!NUMBER_DRAFT_PATTERN.test(nextValue)) return

        setDraftValue(nextValue)
        if (nextValue === '') {
          onChange(undefined)
          return
        }
        if (nextValue === '-' || nextValue === '.' || nextValue === '-.') return

        const parsedValue = Number(nextValue)
        if (!Number.isNaN(parsedValue)) {
          lastExternalValueRef.current = String(parsedValue)
          onChange(parsedValue)
        }
      }}
    />
  )
})

export { NumberField }
