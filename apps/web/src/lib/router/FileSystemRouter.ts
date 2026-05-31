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

// ── Glob parsing ───────────────────────────────────────

function parseGlobKeys(
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

// ── Directory tree ─────────────────────────────────────

function buildTree(entries: FileEntry[]): DirNode {
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

// ── Segment helpers ────────────────────────────────────

function isGroupDir(name: string): boolean {
  return /^\(.+\)$/.test(name)
}

function segmentToPath(name: string): string | null {
  if (isGroupDir(name)) return null
  const paramMatch = name.match(/^\[(.+)\]$/)
  if (paramMatch) return `:${paramMatch[1]}`
  return name
}

// ── Lazy component factory ─────────────────────────────

function createLazyComponent(
  globKey: string,
  glob: Record<string, () => Promise<unknown>>,
) {
  return lazy(async () => {
    const m = (await glob[globKey]()) as Record<string, unknown>
    const Component =
      (m.default as ComponentType) ??
      (Object.values(m).find((v) => typeof v === 'function') as ComponentType)
    if (!Component) throw new Error(`No component export found in ${globKey}`)
    return { default: Component }
  })
}

// ── Tree → RouteObject[] ───────────────────────────────

function buildChildRoutes(
  node: DirNode,
  glob: Record<string, () => Promise<unknown>>,
): RouteObject[] {
  const childRoutes: RouteObject[] = []
  for (const [, child] of node.children) {
    childRoutes.push(...buildChildRoutes(child, glob))
  }

  if (node.notFound) {
    childRoutes.push({
      path: '*',
      element: createElement(createLazyComponent(node.notFound.globKey, glob)),
    })
  }

  const path = segmentToPath(node.name)
  const isGroup = isGroupDir(node.name)

  // Group directory with layout → pathless layout route
  if (isGroup && node.layout) {
    const children: RouteObject[] = []
    if (node.page) {
      children.push({
        index: true,
        element: createElement(createLazyComponent(node.page.globKey, glob)),
      })
    }
    children.push(...childRoutes)
    return [
      {
        element: createElement(
          createLazyComponent(node.layout.globKey, glob),
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
        element: createElement(createLazyComponent(node.page.globKey, glob)),
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
        element: createElement(createLazyComponent(node.page.globKey, glob)),
      })
    }
    children.push(...childRoutes)
    const route: RouteObject = {
      element: createElement(
        createLazyComponent(node.layout.globKey, glob),
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
    route.element = createElement(createLazyComponent(node.page.globKey, glob))
  }
  if (childRoutes.length > 0) {
    route.children = childRoutes
  }

  if (Object.keys(route).length === 0) return []
  return [route]
}

// ── Public API ──────────────────────────────────────────

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
    const entries = parseGlobKeys(this.glob, this.prefix)
    if (entries.length === 0) return []

    const tree = buildTree(entries)
    const routes: RouteObject[] = []

    // Root index page
    if (tree.page) {
      routes.push({
        index: true,
        element: createElement(
          createLazyComponent(tree.page.globKey, this.glob),
        ),
      })
    }

    // Root children
    for (const [, child] of tree.children) {
      routes.push(...buildChildRoutes(child, this.glob))
    }

    // Root 404 catch-all
    if (tree.notFound) {
      routes.push({
        path: '*',
        element: createElement(
          createLazyComponent(tree.notFound.globKey, this.glob),
        ),
      })
    }

    return routes
  }
}
