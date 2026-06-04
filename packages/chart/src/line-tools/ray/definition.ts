import { MoveUpRight } from 'lucide-react'
import type { LineToolDefinition } from '../types'

export const RayDefinition: LineToolDefinition = {
  type: 'Ray',
  label: 'Ray',
  icon: MoveUpRight,
  register(plugin) {
    // Ray is registered by registerLinesPlugin in the registry
  },
}
