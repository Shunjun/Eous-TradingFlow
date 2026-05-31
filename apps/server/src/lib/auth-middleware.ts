import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { validateSession, SESSION_COOKIE } from './auth-utils.js'

declare module 'hono' {
  interface ContextVariableMap {
    userId: string
  }
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE)
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const session = await validateSession(token)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  c.set('userId', session.userId)
  await next()
}
