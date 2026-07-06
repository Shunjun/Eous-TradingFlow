import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { SESSION_COOKIE } from '../lib/auth-utils.js'
import { AppError } from '../lib/app-error.js'
import * as authService from '../modules/auth/index.js'

export const authRouter = new Hono()

const COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60,
  secure: process.env.COOKIE_SECURE === 'true',
}

authRouter.post('/register', async (c) => {
  if (process.env.ALLOW_SELF_REGISTRATION !== 'true') {
    throw new AppError('Registration is disabled', 403)
  }
  const { email, password, name } = await c.req.json<{
    email: string
    password: string
    name?: string
  }>()
  const { user, token } = await authService.register(email, password, name)
  setCookie(c, SESSION_COOKIE, token, COOKIE_OPTIONS)
  return c.json({ user })
})

authRouter.post('/login', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>()
  const { user, token } = await authService.login(email, password)
  setCookie(c, SESSION_COOKIE, token, COOKIE_OPTIONS)
  return c.json({ user })
})

authRouter.post('/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE)
  await authService.logout(token)
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
  return c.json({ ok: true })
})

authRouter.get('/me', async (c) => {
  const token = getCookie(c, SESSION_COOKIE)
  if (!token) throw new AppError('Unauthorized', 401)
  const { validateSession } = await import('../lib/auth-utils.js')
  const session = await validateSession(token)
  if (!session) throw new AppError('Unauthorized', 401)
  const user = await authService.getMe(session.userId)
  return c.json(user)
})
