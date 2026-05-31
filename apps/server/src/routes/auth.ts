import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { prisma } from '@eous/db'
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  validateSession,
  SESSION_COOKIE,
} from '../lib/auth-utils.js'

export const authRouter = new Hono()

const COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60,
  secure: process.env.NODE_ENV === 'production',
}

// ── POST /api/auth/register ─────────────────────────────
authRouter.post('/register', async (c) => {
  if (process.env.ALLOW_SELF_REGISTRATION !== 'true') {
    return c.json({ error: 'Registration is disabled' }, 403)
  }

  const body = await c.req.json<{ email: string; password: string; name?: string }>()
  const { email, password, name } = body

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: 'Invalid email format' }, 400)
  }
  if (!password || password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400)
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return c.json({ error: 'Email already exists' }, 409)
  }

  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({
    data: { email, passwordHash, name: name || null },
  })

  const token = await createSession(user.id)
  setCookie(c, SESSION_COOKIE, token, COOKIE_OPTIONS)

  return c.json({ user: { id: user.id, email: user.email, name: user.name } })
})

// ── POST /api/auth/login ────────────────────────────────
authRouter.post('/login', async (c) => {
  const body = await c.req.json<{ email: string; password: string }>()
  const { email, password } = body

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  const token = await createSession(user.id)
  setCookie(c, SESSION_COOKIE, token, COOKIE_OPTIONS)

  return c.json({ user: { id: user.id, email: user.email, name: user.name } })
})

// ── POST /api/auth/logout ───────────────────────────────
authRouter.post('/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE)
  if (token) {
    await destroySession(token)
  }
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
  return c.json({ ok: true })
})

// ── GET /api/auth/me ────────────────────────────────────
authRouter.get('/me', async (c) => {
  const token = getCookie(c, SESSION_COOKIE)
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const session = await validateSession(token)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true },
  })

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  return c.json(user)
})
