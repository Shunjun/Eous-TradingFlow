import type { NodeDef, NodeComponentProps, ExecuteContext, NodeRegistryEntry } from '../types'

const defModules = import.meta.glob<{
  def: NodeDef
  CanvasNode: (props: NodeComponentProps) => unknown
}>('../src/*/def.ts', { eager: true })

const serverModules = import.meta.glob<{
  execute: (input: Record<string, unknown>, ctx: ExecuteContext) => Promise<Record<string, unknown>>
}>('../src/*/server.ts', { eager: true })

function extractTypeFromPath(path: string): string {
  const match = path.match(/^\.\/src\/(.+)\/def\.ts$/)
  return match?.[1] ?? ''
}

export const nodeRegistry: Record<string, NodeRegistryEntry> = {}

for (const [defPath, defMod] of Object.entries(defModules)) {
  const nodeType = extractTypeFromPath(defPath)
  if (!nodeType) continue

  const serverPath = defPath.replace('/def.ts', '/server.ts')
  const serverMod = serverModules[serverPath]
  if (!serverMod) {
    console.warn(`[node-registry] Missing server.ts for node: ${nodeType}`)
    continue
  }

  nodeRegistry[nodeType] = {
    def: defMod.def,
    canvas: defMod.CanvasNode,
    execute: serverMod.execute,
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
