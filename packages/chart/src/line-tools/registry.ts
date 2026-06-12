import type { ILineToolsPlugin } from 'lightweight-charts-line-tools-core'
import { registerLinesPlugin } from 'lightweight-charts-line-tools-lines'
import type { LineToolDefinition } from './types'
import {
  ArrowDefinition,
  CalloutDefinition,
  CrossLineDefinition,
  ExtendedLineDefinition,
  HorizontalLineDefinition,
  HorizontalRayDefinition,
  RayDefinition,
  TrendLineDefinition,
  VerticalLineDefinition,
} from './lines/definitions'
import { FibRetracementDefinition } from './fib-retracement/definition'
import { RectangleDefinition } from './rectangle/definition'

export const LINE_TOOL_DEFINITIONS: LineToolDefinition[] = [
  TrendLineDefinition,
  ExtendedLineDefinition,
  HorizontalLineDefinition,
  HorizontalRayDefinition,
  VerticalLineDefinition,
  CrossLineDefinition,
  ArrowDefinition,
  RayDefinition,
  CalloutDefinition,
  FibRetracementDefinition,
  RectangleDefinition,
]

export const LINE_TOOL_GROUPS = [
  {
    id: 'lines',
    label: 'Lines',
    tools: [TrendLineDefinition, ExtendedLineDefinition, RayDefinition, ArrowDefinition],
  },
  {
    id: 'levels',
    label: 'Levels',
    tools: [
      HorizontalLineDefinition,
      HorizontalRayDefinition,
      VerticalLineDefinition,
      CrossLineDefinition,
    ],
  },
  {
    id: 'annotations',
    label: 'Annotations',
    tools: [RectangleDefinition, CalloutDefinition],
  },
  {
    id: 'fibonacci',
    label: 'Fibonacci',
    tools: [FibRetracementDefinition],
  },
] satisfies { id: string; label: string; tools: LineToolDefinition[] }[]

export function registerAllLineTools(plugin: ILineToolsPlugin): void {
  registerLinesPlugin(plugin as any)
  for (const def of LINE_TOOL_DEFINITIONS) {
    def.register(plugin)
  }
}
