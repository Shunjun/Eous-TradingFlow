import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { NodeCanvasViewFactory, NodeDef, ExecuteContext, NodeRegistryEntry } from '../types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const nodesDir = join(__dirname, '..', 'nodes')

const nodeDirs = readdirSync(nodesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)

const registry: Record<string, NodeRegistryEntry> = {}

await Promise.all(
  nodeDirs.map(async (dir) => {
    const defPath = join(nodesDir, dir, 'def.ts')
    const serverPath = join(nodesDir, dir, 'server.ts')

    try {
      const defMod = await import(defPath)
      const serverMod = await import(serverPath)

      if (defMod.def && serverMod.execute) {
        registry[dir] = {
          def: defMod.def as NodeDef,
          execute: serverMod.execute as NodeRegistryEntry['execute'],
          getCanvasView: defMod.getCanvasView as NodeCanvasViewFactory | undefined,
        }
      }
    } catch {
      // skip directories that aren't valid node modules
    }
  }),
)

export const nodeRegistry: Record<string, NodeRegistryEntry> = registry

if (Object.keys(nodeRegistry).length === 0) {
  throw new Error('[node-registry] No nodes discovered via fs.readdirSync')
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
