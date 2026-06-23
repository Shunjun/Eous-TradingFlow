import { Separator } from '@eous/ui'
import type { NodeDef } from '@eous/nodes'
import { ConfigField } from './config-fields/config-field'
import { SettingsOutputsEditor } from './settings-outputs-editor'

interface SettingsConfigTabProps {
  nodeDef: NodeDef | undefined
  nodeId: string
  data: Record<string, unknown>
  upstreamOutputs: Record<string, Record<string, unknown>>
  onChange: (data: Record<string, unknown>) => void
}

function SettingsConfigTab({
  nodeDef,
  nodeId,
  data,
  upstreamOutputs,
  onChange,
}: SettingsConfigTabProps) {
  const hasInputs = nodeDef ? Object.keys(nodeDef.executeInput).length > 0 : false

  return (
    <div className="flex flex-col gap-4 p-3">
      {nodeDef && hasInputs && (
        <div className="flex flex-col gap-4">
          {Object.entries(nodeDef.executeInput).map(([fieldKey, param]) => (
            <ConfigField
              key={fieldKey}
              fieldKey={fieldKey}
              param={param}
              nodeId={nodeId}
              data={data}
              onChange={onChange}
              upstreamOutputs={upstreamOutputs}
            />
          ))}
        </div>
      )}
      {hasInputs && <Separator />}
      <SettingsOutputsEditor data={data} nodeDef={nodeDef} onChange={onChange} />
    </div>
  )
}

export { SettingsConfigTab }
export type { SettingsConfigTabProps }
