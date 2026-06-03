import { Minus } from 'lucide-react'
import type { LineToolDefinition } from '../types'

export const HorizontalLineDefinition: LineToolDefinition = {
  type: 'HorizontalLine',
  label: '水平线',
  icon: Minus,
  register(plugin) {
    // HorizontalLine is registered by registerLinesPlugin in the registry
  },
}
