import { prisma, type KnowledgeBase } from '@eous/db'

export function findKnowledgeBasesByUser(userId: string): Promise<KnowledgeBase[]> {
  return prisma.knowledgeBase.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  })
}

export function findKnowledgeBaseByIdAndUser(
  id: string,
  userId: string,
): Promise<KnowledgeBase | null> {
  return prisma.knowledgeBase.findFirst({ where: { id, userId } })
}

export function createKnowledgeBase(data: {
  userId: string
  name: string
  description?: string | null
  metadata?: string
}): Promise<KnowledgeBase> {
  return prisma.knowledgeBase.create({
    data: {
      userId: data.userId,
      name: data.name,
      description: data.description ?? null,
      metadata: data.metadata ?? '{}',
    },
  })
}

export function updateKnowledgeBase(
  id: string,
  data: {
    name?: string
    description?: string | null
    enabled?: boolean
    metadata?: string
    activeIndexId?: string | null
  },
): Promise<KnowledgeBase> {
  return prisma.knowledgeBase.update({ where: { id }, data })
}

export async function deleteKnowledgeBase(id: string): Promise<void> {
  await prisma.knowledgeBase.delete({ where: { id } })
}
