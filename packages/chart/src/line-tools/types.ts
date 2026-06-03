import type { LucideIcon } from 'lucide-react'
import type { LineToolType } from 'lightweight-charts-line-tools-core'
import type { ILineToolsPlugin } from 'lightweight-charts-line-tools-core'

export interface LineToolDefinition {
  type: LineToolType
  label: string
  icon: LucideIcon
  register: (plugin: ILineToolsPlugin) => void
}
