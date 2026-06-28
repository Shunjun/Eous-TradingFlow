import { prisma, type Workflow, type WorkflowVersion } from '@eous/db'

export type WorkflowWithActiveVersion = Workflow & { activeVersion: WorkflowVersion | null }

export function findByUserId(userId: string): Promise<Workflow[]> {
  return prisma.workflow.findMany({
    where: { userId },
    include: { activeVersion: true },
    orderBy: { updatedAt: 'desc' },
  }) as unknown as Promise<Workflow[]>
}

export function findById(id: string): Promise<Workflow | null> {
  return prisma.workflow.findUnique({ where: { id } })
}

export function findByIdWithActiveVersion(id: string): Promise<WorkflowWithActiveVersion | null> {
  return prisma.workflow.findUnique({
    where: { id },
    include: { activeVersion: true },
  }) as unknown as Promise<WorkflowWithActiveVersion | null>
}

export function findEnabledWithActiveVersions(): Promise<WorkflowWithActiveVersion[]> {
  return prisma.workflow.findMany({
    where: { enabled: true, activeVersionId: { not: null } },
    include: { activeVersion: true },
  }) as unknown as Promise<WorkflowWithActiveVersion[]>
}

export function create(data: {
  userId: string
  name: string
  description: string
  definition: string
}): Promise<Workflow> {
  return prisma.workflow.create({ data })
}

export function update(
  id: string,
  data: {
    name?: string
    description?: string
    definition?: string
    enabled?: boolean
    activeVersionId?: string | null
    currentSeq?: number
  },
): Promise<Workflow> {
  return prisma.workflow.update({ where: { id }, data })
}

export async function remove(id: string): Promise<void> {
  await prisma.workflow.delete({ where: { id } })
}

export async function createVersion(data: {
  workflowId: string
  version: number
  definition: string
  createdBy: string
  note?: string
}): Promise<WorkflowVersion> {
  return prisma.workflowVersion.create({ data })
}

export function findVersionById(id: string): Promise<WorkflowVersion | null> {
  return prisma.workflowVersion.findUnique({ where: { id } })
}

export function findVersionsByWorkflowId(workflowId: string): Promise<WorkflowVersion[]> {
  return prisma.workflowVersion.findMany({
    where: { workflowId },
    orderBy: { version: 'desc' },
  })
}

export async function getNextVersion(workflowId: string): Promise<number> {
  const latest = await prisma.workflowVersion.aggregate({
    where: { workflowId },
    _max: { version: true },
  })
  return (latest._max.version ?? 0) + 1
}
