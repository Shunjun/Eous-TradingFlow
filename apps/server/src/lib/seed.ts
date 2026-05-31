import { prisma } from '@eous/db'
import { scrypt, randomBytes } from 'node:crypto'

function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString('hex')
    scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err)
      resolve(`${salt}:${derivedKey.toString('hex')}`)
    })
  })
}

export async function seedInitialUser(): Promise<void> {
  const userCount = await prisma.user.count()
  if (userCount > 0) {
    console.log('[seed] users already exist, skipping seed')
    return
  }

  const email = process.env.INITIAL_USER_EMAIL || 'admin@eous.dev'
  const password = process.env.INITIAL_USER_PASSWORD || 'changeme'
  const passwordHash = await hashPassword(password)

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: 'Admin',
    },
  })

  console.log(`[seed] initial user created: ${email}`)
}
