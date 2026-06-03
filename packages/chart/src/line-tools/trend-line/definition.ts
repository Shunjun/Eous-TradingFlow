import { TrendingUp } from 'lucide-react'
import type { LineToolDefinition } from '../types'

export const TrendLineDefinition: LineToolDefinition = {
  type: 'TrendLine',
  label: '趋势线',
  icon: TrendingUp,
  register(plugin) {
    // TrendLine is registered by registerLinesPlugin in the registry
  },
}
