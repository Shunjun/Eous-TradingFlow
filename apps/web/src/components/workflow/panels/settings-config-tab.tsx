import { Separator } from '@eous/ui'
import type { NodeDef } from '@eous/nodes'
import { ConfigForm } from './config-form'
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
        <ConfigForm
          nodeDef={nodeDef}
          nodeId={nodeId}
          data={data}
          onChange={onChange}
          upstreamOutputs={upstreamOutputs}
        />
      )}
      {hasInputs && <Separator />}
      <SettingsOutputsEditor data={data} nodeDef={nodeDef} onChange={onChange} />
    </div>
  )
}

export { SettingsConfigTab }
export type { SettingsConfigTabProps }
