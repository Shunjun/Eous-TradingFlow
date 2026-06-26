import { Checkbox, Label } from '@eous/ui'
import { isVariableRef } from '../../variables/variable-ref'
import type { ParamDef } from '@eous/nodes'

interface ToggleFieldProps {
  fieldKey: string
  param: ParamDef
  value: unknown
  onChange: (value: unknown) => void
}

function ToggleField({ fieldKey, param, value, onChange }: ToggleFieldProps) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={`field-${fieldKey}`}
        checked={isVariableRef(value) ? false : Boolean(value ?? param.default)}
        onCheckedChange={(checked) => onChange(Boolean(checked))}
      />
      <Label htmlFor={`field-${fieldKey}`} className="text-xs text-muted-foreground">
        {param.description}
      </Label>
    </div>
  )
}

export { ToggleField }
