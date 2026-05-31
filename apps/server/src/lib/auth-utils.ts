import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto'
import { prisma } from '@eous/db'

export const SESSION_COOKIE = 'eous_session'
const SESSION_MAX_AGE_DAYS = 7

export function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString('hex')
    scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err)
      resolve(`${salt}:${derivedKey.toString('hex')}`)
    })
  })
}

export function verifyPassword(password: string, stored: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, hash] = stored.split(':')
    if (!salt || !hash) {
      resolve(false)
      return
    }
    scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err)
      const storedBuf = Buffer.from(hash, 'hex')
      resolve(timingSafeEqual(derivedKey, storedBuf))
    })
  })
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000)

  await prisma.session.create({
    data: { token, userId, expiresAt },
  })

  return token
}

export async function destroySession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } })
}

export async function validateSession(
  token: string,
): Promise<{ userId: string } | null> {
  const session = await prisma.session.findUnique({ where: { token } })
  if (!session) return null
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } })
    return null
  }
  return { userId: session.userId }
}
