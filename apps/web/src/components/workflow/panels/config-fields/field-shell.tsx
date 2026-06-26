import { useCallback, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Label } from '@eous/ui'
import type { ParamDef } from '@eous/nodes'
import { VariablePicker, VariableTag, type VariableRef } from '../../variables'
import { formatVariableRef, isVariableRef, parseVariableRef } from '../../variables/variable-ref'

interface FieldShellProps {
  fieldKey: string
  param: ParamDef
  nodeId: string
  value: unknown
  upstreamOutputs: Record<string, Record<string, unknown>>
  onChange: (value: unknown) => void
  onVariableSelect?: (ref: VariableRef) => void
  children: ReactNode
}

function FieldShell({
  fieldKey,
  param,
  nodeId,
  value,
  upstreamOutputs,
  onChange,
  onVariableSelect,
  children,
}: FieldShellProps) {
  const [variablePickerOpen, setVariablePickerOpen] = useState(false)
  const hasVariable = isVariableRef(value)
  const currentVariable = hasVariable ? parseVariableRef(String(value)) : null
  const label = param.label ?? param.description ?? fieldKey
  const ui = param.ui ?? (param.type === 'number' ? 'number' : 'text')
  const canUseVariable =
    ui !== 'branches' &&
    ui !== 'providerModel' &&
    ui !== 'select' &&
    ui !== 'textarea' &&
    ui !== 'text'

  const handleVariableSelect = useCallback(
    (ref: VariableRef) => {
      if (onVariableSelect) {
        onVariableSelect(ref)
        return
      }
      onChange(formatVariableRef(ref))
    },
    [onChange, onVariableSelect],
  )

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">
          {label}
          {param.required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
        {canUseVariable && (
          <VariablePicker
            nodeId={nodeId}
            acceptTypes={param.acceptTypes}
            upstreamOutputs={upstreamOutputs}
            onSelect={handleVariableSelect}
            open={variablePickerOpen}
            onOpenChange={setVariablePickerOpen}
            currentValue={currentVariable ?? undefined}
          />
        )}
      </div>

      {canUseVariable && currentVariable && (
        <div className="flex items-center gap-1.5">
          <VariableTag refValue={currentVariable} />
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {children}
    </div>
  )
}

export { FieldShell }
