import { prisma, type Provider, type ProviderModel, type UserModelSetting } from '@eous/db'

type ProviderModelWithProvider = ProviderModel & { provider: Provider }

export function findByUser(userId: string): Promise<UserModelSetting | null> {
  return prisma.userModelSetting.findUnique({ where: { userId } })
}

export function upsertForUser(
  userId: string,
  data: {
    compressionProviderId?: string | null
    compressionModelId?: string | null
    embeddingProviderId?: string | null
    embeddingModelId?: string | null
  },
): Promise<UserModelSetting> {
  return prisma.userModelSetting.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  })
}

export function findProviderModelByUser(
  userId: string,
  providerId: string,
  modelId: string,
): Promise<ProviderModelWithProvider | null> {
  return prisma.providerModel.findFirst({
    where: {
      providerId,
      modelId,
      enabled: true,
      provider: { userId, isActive: true },
    },
    include: { provider: true },
  })
}
