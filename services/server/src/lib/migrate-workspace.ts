import { prisma } from '@eous/db'

export async function migrateWorkspaceLayouts(): Promise<void> {
  const users = await prisma.user.findMany({
    where: {
      workspaceLayout: { not: null },
      workspaceLayouts: { none: {} },
    },
    select: { id: true, workspaceLayout: true },
  })

  if (users.length === 0) {
    console.log('[migrate] no workspace layouts to migrate')
    return
  }

  for (const user of users) {
    const layout = await prisma.workspaceLayout.create({
      data: {
        userId: user.id,
        name: 'Default',
        schemaJson: user.workspaceLayout!,
        sortOrder: 0,
      },
    })

    await prisma.user.update({
      where: { id: user.id },
      data: { activeLayoutId: layout.id },
    })
  }

  console.log(`[migrate] migrated ${users.length} user(s) to multi-layout`)
}
