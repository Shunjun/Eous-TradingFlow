import { prisma, type KnowledgeBase, type KnowledgeDocument } from '@eous/db'

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

export function findDocumentsByKnowledgeBase(
  knowledgeBaseId: string,
): Promise<KnowledgeDocument[]> {
  return prisma.knowledgeDocument.findMany({
    where: { knowledgeBaseId },
    orderBy: { updatedAt: 'desc' },
  })
}

export function findDocumentByIdAndUser(
  id: string,
  userId: string,
): Promise<KnowledgeDocument | null> {
  return prisma.knowledgeDocument.findFirst({
    where: { id, knowledgeBase: { userId } },
  })
}

export function createDocument(data: {
  knowledgeBaseId: string
  title: string
  sourceType: string
  sourceUri?: string | null
  sourceFileName?: string | null
  sourceMimeType?: string | null
  sourceSize?: number | null
  sourceHash?: string | null
  strategy: string
  status?: string
  metadata?: string
}): Promise<KnowledgeDocument> {
  return prisma.knowledgeDocument.create({
    data: {
      knowledgeBaseId: data.knowledgeBaseId,
      title: data.title,
      sourceType: data.sourceType,
      sourceUri: data.sourceUri ?? null,
      sourceFileName: data.sourceFileName ?? null,
      sourceMimeType: data.sourceMimeType ?? null,
      sourceSize: data.sourceSize ?? null,
      sourceHash: data.sourceHash ?? null,
      strategy: data.strategy,
      status: data.status ?? 'uploaded',
      content: '',
      metadata: data.metadata ?? '{}',
    },
  })
}

export async function deleteDocument(id: string): Promise<void> {
  await prisma.knowledgeDocument.delete({ where: { id } })
}
