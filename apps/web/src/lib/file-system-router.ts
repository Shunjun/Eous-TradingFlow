import { lazy, createElement, type ComponentType } from 'react'
import type { RouteObject } from 'react-router-dom'

// ── Internal types ─────────────────────────────────────

interface FileEntry {
  segments: string[]
  kind: 'page' | 'layout' | 'notFound'
  globKey: string
}

interface DirNode {
  name: string
  children: Map<string, DirNode>
  page?: FileEntry
  layout?: FileEntry
  notFound?: FileEntry
}

// ── FileSystemRouter ───────────────────────────────────

export class FileSystemRouter {
  private glob: Record<string, () => Promise<unknown>>
  private prefix: string

  constructor(
    glob: Record<string, () => Promise<unknown>>,
    prefix = './pages/',
  ) {
    this.glob = glob
    this.prefix = prefix
  }

  buildRoutes(): RouteObject[] {
    const entries = this.parseGlobKeys(this.glob, this.prefix)
    if (entries.length === 0) return []

    const tree = this.buildTree(entries)
    const routes: RouteObject[] = []

    // Root index page
    if (tree.page) {
      routes.push({
        index: true,
        element: createElement(
          this.createLazyComponent(tree.page.globKey),
        ),
      })
    }

    // Root children
    for (const [, child] of tree.children) {
      routes.push(...this.buildChildRoutes(child))
    }

    // Root 404 catch-all
    if (tree.notFound) {
      routes.push({
        path: '*',
        element: createElement(
          this.createLazyComponent(tree.notFound.globKey),
        ),
      })
    }

    return routes
  }

  // ── Private helpers ─────────────────────────────────

  private parseGlobKeys(
    glob: Record<string, () => Promise<unknown>>,
    prefix: string,
  ): FileEntry[] {
    const entries: FileEntry[] = []

    for (const key of Object.keys(glob)) {
      if (!key.startsWith(prefix)) continue
      const relative = key.slice(prefix.length)
      const parts = relative.split('/')
      const fileName = parts[parts.length - 1]
      const segments = parts.slice(0, -1)

      let kind: FileEntry['kind']
      if (fileName === 'page.tsx') kind = 'page'
      else if (fileName === 'layout.tsx') kind = 'layout'
      else if (fileName === '404.tsx') kind = 'notFound'
      else continue

      entries.push({ segments, kind, globKey: key })
    }

    return entries
  }

  private buildTree(entries: FileEntry[]): DirNode {
    const root: DirNode = { name: '', children: new Map() }

    for (const entry of entries) {
      let current = root
      for (const seg of entry.segments) {
        if (!current.children.has(seg)) {
          current.children.set(seg, { name: seg, children: new Map() })
        }
        current = current.children.get(seg)!
      }

      if (entry.kind === 'page') current.page = entry
      else if (entry.kind === 'layout') current.layout = entry
      else if (entry.kind === 'notFound') current.notFound = entry
    }

    return root
  }

  private buildChildRoutes(node: DirNode): RouteObject[] {
    const childRoutes: RouteObject[] = []
    for (const [, child] of node.children) {
      childRoutes.push(...this.buildChildRoutes(child))
    }

    if (node.notFound) {
      childRoutes.push({
        path: '*',
        element: createElement(this.createLazyComponent(node.notFound.globKey)),
      })
    }

    const path = this.segmentToPath(node.name)
    const isGroup = this.isGroupDir(node.name)

    // Group directory with layout → pathless layout route
    if (isGroup && node.layout) {
      const children: RouteObject[] = []
      if (node.page) {
        children.push({
          index: true,
          element: createElement(this.createLazyComponent(node.page.globKey)),
        })
      }
      children.push(...childRoutes)
      return [
        {
          element: createElement(
            this.createLazyComponent(node.layout.globKey),
          ),
          ...(children.length > 0 ? { children } : {}),
        },
      ]
    }

    // Group directory without layout → flatten children into parent
    if (isGroup) {
      const result: RouteObject[] = []
      if (node.page) {
        result.push({
          index: true,
          element: createElement(this.createLazyComponent(node.page.globKey)),
        })
      }
      result.push(...childRoutes)
      return result
    }

    // Regular directory with layout
    if (node.layout) {
      const children: RouteObject[] = []
      if (node.page) {
        children.push({
          index: true,
          element: createElement(this.createLazyComponent(node.page.globKey)),
        })
      }
      children.push(...childRoutes)
      const route: RouteObject = {
        element: createElement(
          this.createLazyComponent(node.layout.globKey),
        ),
      }
      if (path) route.path = path
      if (children.length > 0) route.children = children
      return [route]
    }

    // Regular directory without layout
    const route: RouteObject = {}
    if (path) route.path = path
    if (node.page) {
      route.element = createElement(this.createLazyComponent(node.page.globKey))
    }
    if (childRoutes.length > 0) {
      route.children = childRoutes
    }

    if (Object.keys(route).length === 0) return []
    return [route]
  }

  private isGroupDir(name: string): boolean {
    return /^\(.+\)$/.test(name)
  }

  private segmentToPath(name: string): string | null {
    if (this.isGroupDir(name)) return null
    const paramMatch = name.match(/^\[(.+)\]$/)
    if (paramMatch) return `:${paramMatch[1]}`
    return name
  }

  private createLazyComponent(globKey: string) {
    return lazy(async () => {
      const m = (await this.glob[globKey]()) as Record<string, unknown>
      const Component =
        (m.default as ComponentType) ??
        (Object.values(m).find((v) => typeof v === 'function') as ComponentType)
      if (!Component) throw new Error(`No component export found in ${globKey}`)
      return { default: Component }
    })
  }
}
