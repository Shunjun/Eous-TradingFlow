import type { IndicatorConfig, IndicatorDefinition } from '../types'

interface IndicatorConfigPanelProps {
  config: IndicatorConfig | null
  definition: IndicatorDefinition | null
  onUpdate: (updates: Partial<IndicatorConfig>) => void
  onRemove: () => void
}

export function IndicatorConfigPanel({
  config,
  definition,
  onUpdate,
  onRemove,
}: IndicatorConfigPanelProps) {
  if (!config || !definition) {
    return null
  }

  const SettingsComponent = definition.SettingsComponent

  return <SettingsComponent config={config} onUpdate={onUpdate} onRemove={onRemove} />
}
