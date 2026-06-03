import { prisma } from '@eous/db'

export async function getLayout(userId: string): Promise<unknown> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { workspaceLayout: true },
  })
  return user?.workspaceLayout ? JSON.parse(user.workspaceLayout) : null
}

export async function saveLayout(userId: string, layout: unknown): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { workspaceLayout: JSON.stringify(layout) },
  })
}
