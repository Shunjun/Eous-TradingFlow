import { useCallback, useRef } from 'react'
import type { VariableRef } from '../../variables'
import { BranchesField } from './branches-field'
import { CodeField } from './code-field'
import { FieldShell } from './field-shell'
import { formatVariableRef } from '../../variables/variable-ref'
import { NumberField } from './number-field'
import { ProviderModelField } from './provider-model-field'
import { ScheduleField } from './schedule-field'
import { SelectField } from './select-field'
import { TextField } from './text-field'
import { TextareaField } from './textarea-field'
import { ToggleField } from './toggle-field'
import type { ParamDef } from '@eous/nodes'

interface ConfigFieldProps {
  fieldKey: string
  param: ParamDef
  nodeId: string
  data: Record<string, unknown>
  onChange: (patch: Record<string, unknown>) => void
  upstreamOutputs: Record<string, Record<string, unknown>>
}

function ConfigField({
  fieldKey,
  param,
  nodeId,
  data,
  onChange,
  upstreamOutputs,
}: ConfigFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const value = data[fieldKey]
  const ui = param.ui ?? (param.type === 'number' ? 'number' : 'text')

  if (param.hidden) return null

  const handleValueChange = useCallback(
    (nextValue: unknown) => {
      onChange({ [fieldKey]: nextValue })
    },
    [fieldKey, onChange],
  )

  const handleVariableSelect = useCallback(
    (ref: VariableRef) => {
      const refValue = formatVariableRef(ref)

      if (ui === 'select' || ui === 'toggle') {
        handleValueChange(refValue)
        return
      }

      const input = inputRef.current
      if (!input) {
        handleValueChange(refValue)
        return
      }

      const start = input.selectionStart ?? 0
      const end = input.selectionEnd ?? 0
      const current = String(value ?? '')
      const nextValue = current.slice(0, start) + refValue + current.slice(end)
      handleValueChange(nextValue)

      requestAnimationFrame(() => {
        input.focus()
        const cursor = start + refValue.length
        input.setSelectionRange(cursor, cursor)
      })
    },
    [handleValueChange, ui, value],
  )

  return (
    <FieldShell
      fieldKey={fieldKey}
      param={param}
      nodeId={nodeId}
      value={value}
      upstreamOutputs={upstreamOutputs}
      onChange={handleValueChange}
      onVariableSelect={handleVariableSelect}
    >
      {ui === 'branches' ? (
        <BranchesField param={param} value={value} onChange={handleValueChange} />
      ) : ui === 'schedule' ? (
        <ScheduleField param={param} value={value} onChange={handleValueChange} />
      ) : ui === 'providerModel' ? (
        <ProviderModelField param={param} data={data} onChange={onChange} />
      ) : ui === 'select' ? (
        <SelectField
          param={param}
          value={value}
          data={data}
          upstreamOutputs={upstreamOutputs}
          onChange={handleValueChange}
        />
      ) : ui === 'code' ? (
        <CodeField ref={inputRef} param={param} value={value} onChange={handleValueChange} />
      ) : ui === 'textarea' ? (
        <TextareaField
          param={param}
          value={value}
          nodeId={nodeId}
          upstreamOutputs={upstreamOutputs}
          onChange={handleValueChange}
        />
      ) : ui === 'toggle' ? (
        <ToggleField fieldKey={fieldKey} param={param} value={value} onChange={handleValueChange} />
      ) : ui === 'number' ? (
        <NumberField ref={inputRef} param={param} value={value} onChange={handleValueChange} />
      ) : (
        <TextField
          param={param}
          value={value}
          nodeId={nodeId}
          upstreamOutputs={upstreamOutputs}
          onChange={handleValueChange}
        />
      )}
    </FieldShell>
  )
}

export { ConfigField }
