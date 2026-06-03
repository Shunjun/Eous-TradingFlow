import type { ILineToolsPlugin } from 'lightweight-charts-line-tools-core'
import { registerLinesPlugin } from 'lightweight-charts-line-tools-lines'
import type { LineToolDefinition } from './types'
import { TrendLineDefinition } from './trend-line/definition'
import { HorizontalLineDefinition } from './horizontal-line/definition'
import { RayDefinition } from './ray/definition'
import { RectangleDefinition } from './rectangle/definition'

export const LINE_TOOL_DEFINITIONS: LineToolDefinition[] = [
  TrendLineDefinition,
  HorizontalLineDefinition,
  RayDefinition,
  RectangleDefinition,
]

export function registerAllLineTools(plugin: ILineToolsPlugin): void {
  registerLinesPlugin(plugin as any)
  for (const def of LINE_TOOL_DEFINITIONS) {
    def.register(plugin)
  }
}
