import {
  prisma,
  type Agent,
  type AgentMessage,
  type AgentMemory,
  type AgentSession,
  type AgentSummary,
  type Provider,
  type ProviderModel,
} from '@eous/db'

export function findAgentsByUser(userId: string): Promise<Agent[]> {
  return prisma.agent.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  })
}

export function findAgentByIdAndUser(id: string, userId: string): Promise<Agent | null> {
  return prisma.agent.findFirst({ where: { id, userId } })
}

export function findFirstAgent(userId: string): Promise<Agent | null> {
  return prisma.agent.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } })
}

export function createAgent(data: {
  userId: string
  name: string
  description?: string | null
  systemPrompt?: string | null
  providerId?: string | null
  modelId?: string | null
}): Promise<Agent> {
  return prisma.agent.create({ data })
}

export function updateAgent(
  id: string,
  data: {
    name?: string
    description?: string | null
    systemPrompt?: string | null
    providerId?: string | null
    modelId?: string | null
  },
): Promise<Agent> {
  return prisma.agent.update({ where: { id }, data })
}

export function findSessionsByUser(userId: string): Promise<AgentSession[]> {
  return prisma.agentSession.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  })
}

export function findSessionByIdAndUser(id: string, userId: string): Promise<AgentSession | null> {
  return prisma.agentSession.findFirst({ where: { id, userId } })
}

export function createSession(data: {
  userId: string
  agentId: string
  title: string
  workflowId?: string | null
}): Promise<AgentSession> {
  return prisma.agentSession.create({ data })
}

export function updateSession(
  id: string,
  data: { title?: string; summary?: string | null },
): Promise<AgentSession> {
  return prisma.agentSession.update({ where: { id }, data })
}

export function findMessages(sessionId: string, limit?: number): Promise<AgentMessage[]> {
  return prisma.agentMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
    ...(limit ? { take: -limit } : {}),
  })
}

export function createMessage(data: {
  userId: string
  sessionId: string
  role: string
  content: string
  metadata?: string
}): Promise<AgentMessage> {
  return prisma.agentMessage.create({ data: { metadata: '{}', ...data } })
}

export function createSummary(data: {
  sessionId: string
  content: string
  fromMessageId?: string | null
  toMessageId?: string | null
}): Promise<AgentSummary> {
  return prisma.agentSummary.create({ data })
}

export function findMemories(params: {
  userId: string
  agentId?: string
  sessionId?: string
  query?: string
  limit?: number
}): Promise<AgentMemory[]> {
  const { userId, agentId, sessionId, query, limit = 8 } = params
  return prisma.agentMemory.findMany({
    where: {
      userId,
      OR: [
        { scope: 'user', targetId: userId },
        ...(agentId ? [{ scope: 'agent', targetId: agentId }, { agentId }] : []),
        ...(sessionId ? [{ scope: 'session', targetId: sessionId }, { sessionId }] : []),
      ],
      ...(query
        ? {
            content: {
              contains: query,
            },
          }
        : {}),
    },
    orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
    take: limit,
  })
}

export function createMemory(data: {
  userId: string
  agentId?: string | null
  sessionId?: string | null
  scope: string
  targetId: string
  kind: string
  content: string
  tags?: string
  importance?: number
  confidence?: number
}): Promise<AgentMemory> {
  return prisma.agentMemory.create({
    data: {
      tags: '[]',
      importance: 1,
      confidence: 0.7,
      ...data,
    },
  })
}

export function findDefaultProviderModel(
  userId: string,
): Promise<(ProviderModel & { provider: Provider }) | null> {
  return prisma.providerModel.findFirst({
    where: { enabled: true, provider: { userId, isActive: true } },
    include: { provider: true },
    orderBy: { createdAt: 'asc' },
  })
}
