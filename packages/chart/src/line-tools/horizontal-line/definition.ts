import { Minus } from 'lucide-react'
import type { LineToolDefinition } from '../types'

export const HorizontalLineDefinition: LineToolDefinition = {
  type: 'HorizontalLine',
  label: 'Horizontal Line',
  icon: Minus,
  register(plugin) {
    // HorizontalLine is registered by registerLinesPlugin in the registry
  },
}
