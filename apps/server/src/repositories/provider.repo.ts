import { prisma, type Provider, type ProviderModel } from '@eous/db'

// ── Provider ────────────────────────────────────────────────────────────────

export function findAllByUser(userId: string): Promise<Provider[]> {
  return prisma.provider.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })
}

export function findByIdAndUser(id: string, userId: string): Promise<Provider | null> {
  return prisma.provider.findFirst({ where: { id, userId } })
}

export function findByNameAndUser(name: string, userId: string): Promise<Provider | null> {
  return prisma.provider.findFirst({ where: { userId, name } })
}

export function create(data: {
  name: string
  kind: string
  baseUrl: string
  apiKeyEncrypted: string
  apiKeyIv: string
  userId: string
}): Promise<Provider> {
  return prisma.provider.create({ data })
}

export function update(id: string, data: Record<string, string>): Promise<Provider> {
  return prisma.provider.update({ where: { id }, data })
}

export async function remove(id: string): Promise<void> {
  await prisma.providerModel.deleteMany({ where: { providerId: id } })
  await prisma.provider.delete({ where: { id } })
}

// ── ProviderModel ───────────────────────────────────────────────────────────

export function findModelsByProvider(providerId: string): Promise<ProviderModel[]> {
  return prisma.providerModel.findMany({ where: { providerId } })
}

export function findModel(providerId: string, modelId: string): Promise<ProviderModel | null> {
  return prisma.providerModel.findUnique({
    where: { providerId_modelId: { providerId, modelId } },
  })
}

export function upsertModel(
  providerId: string,
  model: {
    modelId: string
    displayName?: string | null
    maxTokens?: number | null
    capabilities: string[]
  },
): Promise<ProviderModel> {
  return prisma.providerModel.upsert({
    where: { providerId_modelId: { providerId, modelId: model.modelId } },
    create: {
      providerId,
      modelId: model.modelId,
      displayName: model.displayName ?? null,
      maxTokens: model.maxTokens ?? null,
      capabilities: JSON.stringify(model.capabilities),
    },
    update: {},
  })
}

export function updateModel(id: string, data: Record<string, unknown>): Promise<ProviderModel> {
  return prisma.providerModel.update({ where: { id }, data })
}

export function createModel(
  providerId: string,
  data: {
    modelId: string
    displayName?: string | null
    maxTokens?: number | null
    capabilities?: string[]
  },
): Promise<ProviderModel> {
  return prisma.providerModel.create({
    data: {
      providerId,
      modelId: data.modelId,
      displayName: data.displayName ?? null,
      maxTokens: data.maxTokens ?? null,
      capabilities: JSON.stringify(data.capabilities ?? []),
    },
  })
}
