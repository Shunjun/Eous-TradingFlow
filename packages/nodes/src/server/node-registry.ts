import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { NodeDef, NodeComponentProps, ExecuteContext, NodeRegistryEntry } from '../types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const srcDir = join(__dirname, '..')

const nodeDirs = readdirSync(srcDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)

const registry: Record<string, NodeRegistryEntry> = {}

await Promise.all(
  nodeDirs.map(async (dir) => {
    const defPath = join(srcDir, dir, 'def.ts')
    const serverPath = join(srcDir, dir, 'server.ts')

    try {
      const defMod = await import(defPath)
      const serverMod = await import(serverPath)

      if (defMod.def && serverMod.execute) {
        registry[dir] = {
          def: defMod.def as NodeDef,
          canvas: (defMod.CanvasNode ?? (() => null)) as (props: NodeComponentProps) => unknown,
          execute: serverMod.execute as NodeRegistryEntry['execute'],
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
