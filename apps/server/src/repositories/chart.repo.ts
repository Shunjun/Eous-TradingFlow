import { prisma, type ChartDrawing, type UserChartConfig } from '@eous/db'

const CHART_CONFIG_SCOPE = 'default'

export function findDrawing(
  userId: string,
  instanceId: string,
  symbol: string,
): Promise<ChartDrawing | null> {
  return prisma.chartDrawing.findUnique({
    where: { userId_instanceId_symbol: { userId, instanceId, symbol } },
  })
}

export async function upsertDrawings(
  userId: string,
  instanceId: string,
  drawings: { symbol: string; payload: string }[],
) {
  await prisma.$transaction(
    drawings.map((drawing) =>
      prisma.chartDrawing.upsert({
        where: {
          userId_instanceId_symbol: {
            userId,
            instanceId,
            symbol: drawing.symbol,
          },
        },
        update: { payload: drawing.payload },
        create: {
          userId,
          instanceId,
          symbol: drawing.symbol,
          payload: drawing.payload,
        },
      }),
    ),
  )
}

export function getChartConfig(userId: string): Promise<UserChartConfig> {
  return prisma.userChartConfig.upsert({
    where: { userId_scope: { userId, scope: CHART_CONFIG_SCOPE } },
    update: {},
    create: { userId, scope: CHART_CONFIG_SCOPE },
  })
}

export function updateChartConfig(
  userId: string,
  data: { autoSaveDrawings?: boolean },
): Promise<UserChartConfig> {
  return prisma.userChartConfig.upsert({
    where: { userId_scope: { userId, scope: CHART_CONFIG_SCOPE } },
    update: data,
    create: { userId, scope: CHART_CONFIG_SCOPE, autoSaveDrawings: data.autoSaveDrawings ?? false },
  })
}
