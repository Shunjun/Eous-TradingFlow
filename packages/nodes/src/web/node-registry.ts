import type { NodeCanvasViewFactory, NodeDef, WebNodeRegistryEntry } from '../types'

const defModules = import.meta.glob<{
  def: NodeDef
  getCanvasView?: NodeCanvasViewFactory
}>('../nodes/*/def.ts', { eager: true })

function extractTypeFromPath(path: string): string {
  const match = path.match(/^\.\.\/nodes\/(.+)\/def\.ts$/)
  return match?.[1] ?? ''
}

export const nodeRegistry: Record<string, WebNodeRegistryEntry> = {}

for (const [defPath, defMod] of Object.entries(defModules)) {
  const nodeType = extractTypeFromPath(defPath)
  if (!nodeType) continue

  nodeRegistry[nodeType] = {
    def: defMod.def,
    getCanvasView: defMod.getCanvasView,
  }
}

if (Object.keys(nodeRegistry).length === 0) {
  throw new Error('[node-registry] No nodes discovered via import.meta.glob')
}

export const allNodeMetas = Object.values(nodeRegistry).map((entry) => entry.def.meta)

export function getNodeOutputs(
  nodeType: string,
): Record<string, import('../types').OutputField> | undefined {
  return nodeRegistry[nodeType]?.def.executeOutput
}

export function getNodeDef(nodeType: string): NodeDef | undefined {
  return nodeRegistry[nodeType]?.def
}
