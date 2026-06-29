import { prisma, type DataSourceInstance, type TrackedSymbol } from '@eous/db'

// ── DataSourceInstance ───────────────────────────────────────────────────────

export function findAllByUser(userId: string): Promise<DataSourceInstance[]> {
  return prisma.dataSourceInstance.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })
}

export function findByIdAndUser(id: string, userId: string): Promise<DataSourceInstance | null> {
  return prisma.dataSourceInstance.findFirst({ where: { id, userId } })
}

export function findByIdWithSymbols(
  id: string,
  userId: string,
): Promise<(DataSourceInstance & { trackedSymbols: TrackedSymbol[] }) | null> {
  return prisma.dataSourceInstance.findFirst({
    where: { id, userId },
    include: { trackedSymbols: true },
  })
}

export function findByNameAndUser(
  name: string,
  userId: string,
): Promise<DataSourceInstance | null> {
  return prisma.dataSourceInstance.findFirst({ where: { userId, name } })
}

export function create(data: {
  name: string
  providerKind: string
  defaultSymbol: string
  identityKey?: string | null
  identityLabel?: string | null
  configEncrypted: string
  configIv: string
  userId: string
}): Promise<DataSourceInstance> {
  return prisma.dataSourceInstance.create({ data })
}

export function update(id: string, data: Record<string, unknown>): Promise<DataSourceInstance> {
  return prisma.dataSourceInstance.update({ where: { id }, data })
}

export async function remove(id: string): Promise<void> {
  await prisma.dataSourceInstance.delete({ where: { id } })
}

// ── TrackedSymbol ───────────────────────────────────────────────────────────

export function findSymbol(instanceId: string, symbol: string): Promise<TrackedSymbol | null> {
  return prisma.trackedSymbol.findFirst({ where: { instanceId, symbol } })
}

export function createSymbol(data: {
  instanceId: string
  symbol: string
  name: string
  exchange?: string | null
  type?: string | null
}): Promise<TrackedSymbol> {
  return prisma.trackedSymbol.create({ data })
}

export function deleteSymbol(symbolId: string): Promise<TrackedSymbol> {
  return prisma.trackedSymbol.delete({ where: { id: symbolId } })
}

export function findSymbolByIdAndInstance(
  id: string,
  instanceId: string,
): Promise<TrackedSymbol | null> {
  return prisma.trackedSymbol.findFirst({ where: { id, instanceId } })
}
