import { prisma } from '@eous/db'

export async function listLayouts(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      activeLayoutId: true,
      workspaceLayouts: {
        select: { id: true, name: true, updatedAt: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })
  return {
    layouts: user?.workspaceLayouts ?? [],
    activeLayoutId: user?.activeLayoutId ?? null,
  }
}

export async function getLayout(userId: string, layoutId: string) {
  return prisma.workspaceLayout.findFirst({
    where: { id: layoutId, userId },
    select: { id: true, name: true, schemaJson: true, updatedAt: true },
  })
}

export async function createLayout(
  userId: string,
  params: { name: string; schemaJson?: string; setActive?: boolean },
) {
  const maxSort = await prisma.workspaceLayout.aggregate({
    where: { userId },
    _max: { sortOrder: true },
  })

  const layout = await prisma.workspaceLayout.create({
    data: {
      userId,
      name: params.name,
      schemaJson: params.schemaJson ?? 'null',
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
    select: { id: true, name: true },
  })

  if (params.setActive) {
    await prisma.user.update({
      where: { id: userId },
      data: { activeLayoutId: layout.id },
    })
  }

  return layout
}

export async function updateLayout(
  userId: string,
  layoutId: string,
  data: { schemaJson?: string; name?: string },
): Promise<void> {
  await prisma.workspaceLayout.updateMany({
    where: { id: layoutId, userId },
    data,
  })
}

export async function deleteLayout(userId: string, layoutId: string) {
  const count = await prisma.workspaceLayout.count({ where: { userId } })
  if (count <= 1) {
    throw new Error('Cannot delete the last layout')
  }

  await prisma.workspaceLayout.deleteMany({
    where: { id: layoutId, userId },
  })

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeLayoutId: true },
  })

  let newActiveLayoutId: string | undefined
  if (user?.activeLayoutId === layoutId) {
    const first = await prisma.workspaceLayout.findFirst({
      where: { userId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true },
    })
    newActiveLayoutId = first?.id
    await prisma.user.update({
      where: { id: userId },
      data: { activeLayoutId: newActiveLayoutId ?? null },
    })
  }

  return { newActiveLayoutId }
}

export async function activateLayout(userId: string, layoutId: string) {
  const layout = await prisma.workspaceLayout.findFirst({
    where: { id: layoutId, userId },
    select: { id: true },
  })
  if (!layout) throw new Error('Layout not found')

  await prisma.user.update({
    where: { id: userId },
    data: { activeLayoutId: layoutId },
  })

  return { activeLayoutId: layoutId }
}
