import { Suspense, createElement } from 'react'
import { createBrowserRouter, redirect, type RouteObject } from 'react-router-dom'
import { FileSystemRouter } from './lib/router/index.js'
import { PageLoading } from './components/PageLoading.js'

// ── Scan page files ────────────────────────────────────
const pages = import.meta.glob('./pages/**/*.tsx')

// ── Build route tree ───────────────────────────────────
const fsRouter = new FileSystemRouter(pages)
const rawRoutes = fsRouter.buildRoutes()

// ── Wrap each element in Suspense ──────────────────────
function wrapSuspense(routes: RouteObject[]): RouteObject[] {
  return routes.map((route) => {
    const element = route.element
      ? createElement(
          Suspense,
          { fallback: createElement(PageLoading) },
          route.element,
        )
      : undefined

    if (route.index) {
      return { index: true, path: route.path, element } as RouteObject
    }

    return {
      path: route.path,
      element,
      children: route.children ? wrapSuspense(route.children) : undefined,
    } as RouteObject
  })
}

// ── Inject loaders ─────────────────────────────────────
function injectLoaders(routes: RouteObject[]): void {
  for (const route of routes) {
    // Auth layout: pathless route with children → enforce login
    if (!route.path && route.children && !route.loader) {
      route.loader = async () => {
        const res = await fetch('/api/auth/me', { credentials: 'include' })
        if (!res.ok) throw redirect('/login')
        return res.json()
      }
    }

    // Login page: redirect to / if already authenticated
    if (route.path === 'login' && !route.loader) {
      route.loader = async () => {
        const res = await fetch('/api/auth/me', { credentials: 'include' })
        if (res.ok) throw redirect('/')
        return null
      }
    }

    if (route.children) injectLoaders(route.children)
  }
}

const wrappedRoutes = wrapSuspense(rawRoutes)
injectLoaders(wrappedRoutes)

// ── Create and export ──────────────────────────────────
export const router = createBrowserRouter(wrappedRoutes)
