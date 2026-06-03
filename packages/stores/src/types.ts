export type IndicatorDisplayMode = 'overlay' | 'split'

export interface IndicatorConfig {
  id: string
  type: string
  label: string
  enabled: boolean
  mode: IndicatorDisplayMode
  params: Record<string, number>
  color?: string
}
