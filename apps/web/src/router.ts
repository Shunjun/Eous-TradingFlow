import { Suspense, createElement } from 'react'
import { createBrowserRouter, redirect, type RouteObject } from 'react-router-dom'
import { FileSystemRouter } from './lib/file-system-router.js'
import { PageLoading } from './components/PageLoading.js'
import { api, ApiError } from './lib/api.js'

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
          { fallback: createElement(PageLoading, { fullScreen: true }) },
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
        try {
          return await api.me()
        } catch (e) {
          if (e instanceof ApiError) throw redirect('/login')
          throw e
        }
      }
    }

    // Login page: redirect to / if already authenticated
    if (route.path === 'login' && !route.loader) {
      route.loader = async () => {
        try {
          await api.me()
          throw redirect('/')
        } catch (e) {
          if (e instanceof ApiError) return null
          throw e
        }
      }
    }

    if (route.children) injectLoaders(route.children)
  }
}

const wrappedRoutes = wrapSuspense(rawRoutes)
injectLoaders(wrappedRoutes)

// ── Create and export ──────────────────────────────────
export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter(wrappedRoutes)
