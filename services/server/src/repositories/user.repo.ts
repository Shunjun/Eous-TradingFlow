import { prisma, type User } from '@eous/db'

export function findByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } })
}

export function findById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } })
}

export function create({
  email,
  passwordHash,
  name,
}: {
  email: string
  passwordHash: string
  name?: string
}): Promise<User> {
  return prisma.user.create({
    data: { email, passwordHash, name: name || null },
  })
}
