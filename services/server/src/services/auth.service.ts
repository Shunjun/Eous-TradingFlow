import { AppError } from '../lib/app-error.js'
import { hashPassword, verifyPassword, createSession, destroySession } from '../lib/auth-utils.js'
import * as userRepo from '../repositories/user.repo.js'
import * as sessionRepo from '../repositories/session.repo.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function register(email: string, password: string, name?: string) {
  if (!email || !EMAIL_RE.test(email)) {
    throw new AppError('Invalid email format', 400)
  }
  if (!password || password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400)
  }

  const existing = await userRepo.findByEmail(email)
  if (existing) {
    throw new AppError('Email already exists', 409)
  }

  const passwordHash = await hashPassword(password)
  const user = await userRepo.create({ email, passwordHash, name })

  const token = await createSession(user.id)

  return {
    user: { id: user.id, email: user.email, name: user.name },
    token,
  }
}

export async function login(email: string, password: string) {
  const user = await userRepo.findByEmail(email)
  if (!user) {
    throw new AppError('Invalid email or password', 401)
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    throw new AppError('Invalid email or password', 401)
  }

  const token = await createSession(user.id)

  return {
    user: { id: user.id, email: user.email, name: user.name },
    token,
  }
}

export async function logout(token: string | undefined) {
  if (token) {
    await destroySession(token)
  }
}

export async function getMe(userId: string) {
  const user = await userRepo.findById(userId)
  if (!user) {
    throw new AppError('Unauthorized', 401)
  }
  return user
}
