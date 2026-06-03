import { MoveUpRight } from 'lucide-react'
import type { LineToolDefinition } from '../types'

export const RayDefinition: LineToolDefinition = {
  type: 'Ray',
  label: '射线',
  icon: MoveUpRight,
  register(plugin) {
    // Ray is registered by registerLinesPlugin in the registry
  },
}
