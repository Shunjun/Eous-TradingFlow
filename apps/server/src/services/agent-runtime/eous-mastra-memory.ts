import { randomUUID } from 'node:crypto'
import { prisma } from '@eous/db'
import { MastraMemory } from '@mastra/core/memory'
import type {
  MastraDBMessage,
  MemoryConfig,
  MemoryConfigInternal,
  MessageDeleteInput,
  StorageThreadType,
  WorkingMemoryTemplate,
} from '@mastra/core/memory'
import type {
  StorageCloneThreadInput,
  StorageCloneThreadOutput,
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsInput,
  StorageListThreadsOutput,
} from '@mastra/core/storage'
import type { ObservabilityContext } from '@mastra/core/observability'

function parseJsonObject(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? {})
}

function parseMessageContent(raw: string): MastraDBMessage['content'] {
  const parsed = parseJsonObject(raw)
  if (parsed.format === 2 && Array.isArray(parsed.parts)) {
    return parsed as MastraDBMessage['content']
  }

  return {
    format: 2,
    parts: [{ type: 'text', text: raw }],
    content: raw,
  } as MastraDBMessage['content']
}

function messageToMastra(message: {
  id: string
  sessionId: string
  role: string
  type: string
  resourceId: string | null
  content: string
  metadata: string
  createdAt: Date
}): MastraDBMessage {
  const metadata = parseJsonObject(message.metadata)
  const role = ['user', 'assistant', 'system', 'signal'].includes(message.role)
    ? (message.role as MastraDBMessage['role'])
    : 'assistant'

  return {
    id: message.id,
    role,
    type: message.type,
    threadId: message.sessionId,
    resourceId: message.resourceId ?? undefined,
    createdAt: message.createdAt,
    content: parseMessageContent(message.content),
    ...metadata,
  }
}

function sessionToThread(session: {
  id: string
  userId: string
  agentId: string
  title: string
  workflowId: string | null
  createdAt: Date
  updatedAt: Date
}): StorageThreadType {
  return {
    id: session.id,
    resourceId: session.userId,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    metadata: {
      agentId: session.agentId,
      workflowId: session.workflowId,
    },
  }
}

function normalizeMessageIds(input: MessageDeleteInput): string[] {
  if (!Array.isArray(input)) return []
  return input
    .map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object' && typeof item.id === 'string') return item.id
      return null
    })
    .filter((item): item is string => Boolean(item))
}

export class EousMastraMemory extends MastraMemory {
  constructor() {
    super({
      name: 'Eous Mastra Memory',
      options: {
        lastMessages: 20,
        semanticRecall: false,
        workingMemory: { enabled: false },
      },
    })
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    const session = await prisma.agentSession.findUnique({ where: { id: threadId } })
    return session ? sessionToThread(session) : null
  }

  async listThreads(args: StorageListThreadsInput): Promise<StorageListThreadsOutput> {
    const page = args.page ?? 0
    const perPage = args.perPage ?? 100
    const where = {
      ...(args.filter?.resourceId ? { userId: args.filter.resourceId } : {}),
    }
    const [total, sessions] = await Promise.all([
      prisma.agentSession.count({ where }),
      prisma.agentSession.findMany({
        where,
        orderBy: { updatedAt: args.orderBy?.direction === 'ASC' ? 'asc' : 'desc' },
        ...(perPage === false ? {} : { skip: page * perPage, take: perPage }),
      }),
    ])

    return {
      threads: sessions.map(sessionToThread),
      total,
      page,
      perPage,
      hasMore: perPage === false ? false : (page + 1) * perPage < total,
    }
  }

  async saveThread({
    thread,
  }: {
    thread: StorageThreadType
    memoryConfig?: MemoryConfigInternal
  }): Promise<StorageThreadType> {
    const existing = await prisma.agentSession.findUnique({ where: { id: thread.id } })
    if (!existing) return thread

    const updated = await prisma.agentSession.update({
      where: { id: thread.id },
      data: {
        title: thread.title ?? existing.title,
        workflowId:
          typeof thread.metadata?.workflowId === 'string'
            ? thread.metadata.workflowId
            : existing.workflowId,
      },
    })
    return sessionToThread(updated)
  }

  async updateThread({
    id,
    title,
    metadata,
  }: {
    id: string
    title: string
    metadata: Record<string, unknown>
    memoryConfig?: MemoryConfigInternal
  }): Promise<StorageThreadType> {
    const updated = await prisma.agentSession.update({
      where: { id },
      data: {
        title,
        workflowId: typeof metadata.workflowId === 'string' ? metadata.workflowId : undefined,
      },
    })
    return sessionToThread(updated)
  }

  async deleteThread(threadId: string): Promise<void> {
    await prisma.agentSession.delete({ where: { id: threadId } })
  }

  async saveMessages({
    messages,
  }: {
    messages: MastraDBMessage[]
    memoryConfig?: MemoryConfig | undefined
    observabilityContext?: Partial<ObservabilityContext>
  }): Promise<{ messages: MastraDBMessage[] }> {
    const saved: MastraDBMessage[] = []

    for (const message of messages) {
      if (!message.threadId) continue
      const thread = await prisma.agentSession.findUnique({ where: { id: message.threadId } })
      if (!thread) continue

      await prisma.agentMessage.upsert({
        where: { id: message.id },
        create: {
          id: message.id,
          userId: message.resourceId ?? thread.userId,
          sessionId: message.threadId,
          role: message.role,
          type: message.type ?? 'text',
          resourceId: message.resourceId ?? thread.userId,
          content: stringifyJson(message.content),
          metadata: stringifyJson({
            threadId: message.threadId,
            resourceId: message.resourceId,
          }),
          createdAt: message.createdAt,
        },
        update: {
          role: message.role,
          type: message.type ?? 'text',
          resourceId: message.resourceId ?? thread.userId,
          content: stringifyJson(message.content),
          metadata: stringifyJson({
            threadId: message.threadId,
            resourceId: message.resourceId,
          }),
        },
      })
      saved.push(message)
    }

    return { messages: saved }
  }

  async recall(
    args: StorageListMessagesInput & {
      threadConfig?: MemoryConfigInternal
      vectorSearchString?: string
      includeSystemReminders?: boolean
      observabilityContext?: Partial<ObservabilityContext>
    },
  ): Promise<StorageListMessagesOutput> {
    const page = args.page ?? 0
    const perPage = args.perPage ?? args.threadConfig?.lastMessages ?? 20
    const threadIds = Array.isArray(args.threadId) ? args.threadId : [args.threadId]
    const where = {
      sessionId: { in: threadIds },
      ...(args.resourceId ? { resourceId: args.resourceId } : {}),
    }

    const total = await prisma.agentMessage.count({ where })
    const rows = await prisma.agentMessage.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      ...(perPage === false
        ? {}
        : { skip: Math.max(totalSkip(page, perPage, total), 0), take: perPage }),
    })

    return {
      messages: rows.map(messageToMastra),
      total,
      page,
      perPage,
      hasMore: perPage === false ? false : (page + 1) * perPage < total,
    }
  }

  async deleteMessages(messageIds: MessageDeleteInput): Promise<void> {
    const ids = normalizeMessageIds(messageIds)
    if (ids.length === 0) return
    await prisma.agentMessage.deleteMany({ where: { id: { in: ids } } })
  }

  async getWorkingMemory(): Promise<string | null> {
    return null
  }

  async getWorkingMemoryTemplate(): Promise<WorkingMemoryTemplate | null> {
    return null
  }

  async updateWorkingMemory(): Promise<void> {}

  async __experimental_updateWorkingMemoryVNext(): Promise<{ success: boolean; reason: string }> {
    return { success: false, reason: 'Working memory is disabled' }
  }

  async cloneThread(args: StorageCloneThreadInput): Promise<StorageCloneThreadOutput> {
    const source = await this.getThreadById({ threadId: args.sourceThreadId })
    if (!source) throw new Error('Source thread not found')
    const sourceSession = await prisma.agentSession.findUnique({
      where: { id: args.sourceThreadId },
    })
    if (!sourceSession) throw new Error('Source thread not found')

    const newThreadId = args.newThreadId ?? randomUUID()
    const cloned = await prisma.agentSession.create({
      data: {
        id: newThreadId,
        userId: args.resourceId ?? source.resourceId,
        agentId: sourceSession.agentId,
        title: args.title ?? source.title ?? 'Cloned conversation',
        workflowId: typeof args.metadata?.workflowId === 'string' ? args.metadata.workflowId : null,
      },
    })

    return {
      thread: sessionToThread(cloned),
      clonedMessages: [],
      messageIdMap: {},
    }
  }
}

function totalSkip(page: number, perPage: number | false, total: number): number {
  if (perPage === false) return 0
  if (page > 0) return page * perPage
  return Math.max(total - perPage, 0)
}

export const eousMastraMemory = new EousMastraMemory()
