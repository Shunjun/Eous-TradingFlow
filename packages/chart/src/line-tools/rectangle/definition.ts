import { Square } from 'lucide-react'
import { LineToolRectangle } from 'lightweight-charts-line-tools-rectangle'
import type { LineToolDefinition } from '../types'

export const RectangleDefinition: LineToolDefinition = {
  type: 'Rectangle',
  label: '矩形',
  icon: Square,
  register(plugin) {
    plugin.registerLineTool('Rectangle', LineToolRectangle as any)
  },
}
