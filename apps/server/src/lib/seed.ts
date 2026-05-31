import { prisma } from '@eous/db'
import { hashPassword } from './auth-utils.js'

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
