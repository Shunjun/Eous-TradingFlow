import { prisma, type Session } from '@eous/db'

export function create(userId: string, token: string, expiresAt: Date): Promise<Session> {
  return prisma.session.create({
    data: { token, userId, expiresAt },
  })
}

export function findByToken(token: string): Promise<Session | null> {
  return prisma.session.findUnique({ where: { token } })
}

export async function deleteByToken(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } })
}
