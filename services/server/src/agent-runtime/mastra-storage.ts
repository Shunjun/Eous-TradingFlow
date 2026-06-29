import { randomUUID } from 'node:crypto'
import { prisma } from '@eous/db'
import { MastraCompositeStore, MemoryStorage } from '@mastra/core/storage'
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory'
import type {
  BufferedObservationChunk,
  CreateObservationalMemoryInput,
  CreateReflectionGenerationInput,
  ObservationalMemoryHistoryOptions,
  ObservationalMemoryRecord,
  StorageCloneThreadInput,
  StorageCloneThreadOutput,
  StorageListMessagesByResourceIdInput,
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsInput,
  StorageListThreadsOutput,
  StorageResourceType,
  SwapBufferedReflectionToActiveInput,
  SwapBufferedToActiveInput,
  SwapBufferedToActiveResult,
  UpdateActiveObservationsInput,
  UpdateBufferedObservationsInput,
  UpdateBufferedReflectionInput,
  UpdateObservationalMemoryConfigInput,
} from '@mastra/core/storage'

const observationalMemoryRepo = (prisma as any).agentObservationalMemory

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

function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
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

function resourceToMastra(resource: {
  id: string
  workingMemory: string | null
  metadata: string
  createdAt: Date
  updatedAt: Date
}): StorageResourceType {
  return {
    id: resource.id,
    workingMemory: resource.workingMemory ?? undefined,
    metadata: parseJsonObject(resource.metadata),
    createdAt: resource.createdAt,
    updatedAt: resource.updatedAt,
  }
}

function reviveDate(value: unknown): Date | undefined {
  if (value instanceof Date) return value
  if (typeof value !== 'string') return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function observationToMastra(row: {
  payload: string
  createdAt: Date
  updatedAt: Date
}): ObservationalMemoryRecord {
  const record = parseJsonObject(row.payload) as unknown as ObservationalMemoryRecord
  return {
    ...record,
    createdAt: reviveDate(record.createdAt) ?? row.createdAt,
    updatedAt: reviveDate(record.updatedAt) ?? row.updatedAt,
    lastObservedAt: reviveDate(record.lastObservedAt),
    lastBufferedAtTime: reviveDate(record.lastBufferedAtTime) ?? null,
    bufferedObservationChunks: record.bufferedObservationChunks?.map((chunk) => ({
      ...chunk,
      lastObservedAt: reviveDate(chunk.lastObservedAt) ?? new Date(0),
    })),
  }
}

function toBufferedChunk(
  chunk: UpdateBufferedObservationsInput['chunk'],
): BufferedObservationChunk {
  return {
    id: randomUUID(),
    createdAt: new Date(),
    ...chunk,
  }
}

function observationPayload(record: ObservationalMemoryRecord): string {
  return stringifyJson(record)
}

function appendText(left: string, right: string): string {
  if (!left.trim()) return right
  if (!right.trim()) return left
  return `${left.trimEnd()}\n${right.trimStart()}`
}

function countLines(text: string): number {
  if (!text) return 0
  return text.split('\n').length
}

function totalSkip(page: number, perPage: number | false, total: number): number {
  if (perPage === false) return 0
  if (page > 0) return page * perPage
  return Math.max(total - perPage, 0)
}

export class MastraMemoryStorage extends MemoryStorage {
  readonly supportsObservationalMemory = true

  async dangerouslyClearAll(): Promise<void> {
    await observationalMemoryRepo.deleteMany()
    await prisma.agentMessage.deleteMany()
    await prisma.agentResource.deleteMany()
  }

  async getThreadById({
    threadId,
    resourceId,
  }: {
    threadId: string
    resourceId?: string
  }): Promise<StorageThreadType | null> {
    const session = await prisma.agentSession.findFirst({
      where: { id: threadId, ...(resourceId ? { userId: resourceId } : {}) },
    })
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

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
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

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    await prisma.agentSession.delete({ where: { id: threadId } })
  }

  async listMessages(args: StorageListMessagesInput): Promise<StorageListMessagesOutput> {
    const page = args.page ?? 0
    const perPage = args.perPage ?? 40
    const threadIds = Array.isArray(args.threadId) ? args.threadId : [args.threadId]
    const where = {
      sessionId: { in: threadIds },
      ...(args.resourceId ? { resourceId: args.resourceId } : {}),
      ...(args.filter?.dateRange
        ? {
            createdAt: {
              ...(args.filter.dateRange.start
                ? {
                    [args.filter.dateRange.startExclusive ? 'gt' : 'gte']:
                      args.filter.dateRange.start,
                  }
                : {}),
              ...(args.filter.dateRange.end
                ? { [args.filter.dateRange.endExclusive ? 'lt' : 'lte']: args.filter.dateRange.end }
                : {}),
            },
          }
        : {}),
    }

    const total = await prisma.agentMessage.count({ where })
    const rows = await prisma.agentMessage.findMany({
      where,
      orderBy: { createdAt: args.orderBy?.direction === 'DESC' ? 'desc' : 'asc' },
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

  async listMessagesByResourceId(
    args: StorageListMessagesByResourceIdInput,
  ): Promise<StorageListMessagesOutput> {
    const page = args.page ?? 0
    const perPage = args.perPage ?? 40
    const where = {
      resourceId: args.resourceId,
      ...(args.filter?.dateRange
        ? {
            createdAt: {
              ...(args.filter.dateRange.start
                ? {
                    [args.filter.dateRange.startExclusive ? 'gt' : 'gte']:
                      args.filter.dateRange.start,
                  }
                : {}),
              ...(args.filter.dateRange.end
                ? { [args.filter.dateRange.endExclusive ? 'lt' : 'lte']: args.filter.dateRange.end }
                : {}),
            },
          }
        : {}),
    }

    const total = await prisma.agentMessage.count({ where })
    const rows = await prisma.agentMessage.findMany({
      where,
      orderBy: { createdAt: args.orderBy?.direction === 'DESC' ? 'desc' : 'asc' },
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

  async listMessagesById({ messageIds }: { messageIds: string[] }) {
    const rows = await prisma.agentMessage.findMany({
      where: { id: { in: messageIds } },
      orderBy: { createdAt: 'asc' },
    })
    return { messages: rows.map(messageToMastra) }
  }

  async saveMessages({ messages }: { messages: MastraDBMessage[] }) {
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

  async updateMessages(args: {
    messages: (Partial<Omit<MastraDBMessage, 'createdAt'>> & { id: string })[]
  }): Promise<MastraDBMessage[]> {
    const updated: MastraDBMessage[] = []

    for (const message of args.messages) {
      const existing = await prisma.agentMessage.findUnique({ where: { id: message.id } })
      if (!existing) continue
      const row = await prisma.agentMessage.update({
        where: { id: message.id },
        data: {
          role: message.role ?? existing.role,
          type: message.type ?? existing.type,
          resourceId: message.resourceId ?? existing.resourceId,
          content: message.content ? stringifyJson(message.content) : existing.content,
        },
      })
      updated.push(messageToMastra(row))
    }

    return updated
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return
    await prisma.agentMessage.deleteMany({ where: { id: { in: messageIds } } })
  }

  async getResourceById({
    resourceId,
  }: {
    resourceId: string
  }): Promise<StorageResourceType | null> {
    const resource = await prisma.agentResource.findUnique({ where: { id: resourceId } })
    return resource ? resourceToMastra(resource) : null
  }

  async saveResource({
    resource,
  }: {
    resource: StorageResourceType
  }): Promise<StorageResourceType> {
    const saved = await prisma.agentResource.upsert({
      where: { id: resource.id },
      create: {
        id: resource.id,
        userId: resource.id,
        workingMemory: resource.workingMemory,
        metadata: stringifyJson(resource.metadata),
        createdAt: resource.createdAt,
        updatedAt: resource.updatedAt,
      },
      update: {
        workingMemory: resource.workingMemory,
        metadata: stringifyJson(resource.metadata),
      },
    })
    return resourceToMastra(saved)
  }

  async updateResource({
    resourceId,
    workingMemory,
    metadata,
  }: {
    resourceId: string
    workingMemory?: string
    metadata?: Record<string, unknown>
  }): Promise<StorageResourceType> {
    const existing = await prisma.agentResource.findUnique({ where: { id: resourceId } })
    const saved = await prisma.agentResource.upsert({
      where: { id: resourceId },
      create: {
        id: resourceId,
        userId: resourceId,
        workingMemory,
        metadata: stringifyJson(metadata),
      },
      update: {
        workingMemory: workingMemory ?? existing?.workingMemory,
        metadata: metadata ? stringifyJson(metadata) : undefined,
      },
    })
    return resourceToMastra(saved)
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

  async getObservationalMemory(
    threadId: string | null,
    resourceId: string,
  ): Promise<ObservationalMemoryRecord | null> {
    const row = await observationalMemoryRepo.findFirst({
      where: {
        resourceId,
        ...(threadId ? { threadId } : { threadId: null }),
      },
      orderBy: { createdAt: 'desc' },
    })
    return row ? observationToMastra(row) : null
  }

  async getObservationalMemoryHistory(
    threadId: string | null,
    resourceId: string,
    limit = 50,
    options?: ObservationalMemoryHistoryOptions,
  ): Promise<ObservationalMemoryRecord[]> {
    const rows = await observationalMemoryRepo.findMany({
      where: {
        resourceId,
        ...(threadId ? { threadId } : { threadId: null }),
        createdAt: {
          ...(options?.from ? { gte: options.from } : {}),
          ...(options?.to ? { lte: options.to } : {}),
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: options?.offset ?? 0,
      take: limit,
    })
    return rows.map(observationToMastra)
  }

  async initializeObservationalMemory(
    input: CreateObservationalMemoryInput,
  ): Promise<ObservationalMemoryRecord> {
    const now = new Date()
    const record: ObservationalMemoryRecord = {
      id: randomUUID(),
      scope: input.scope,
      threadId: input.threadId,
      resourceId: input.resourceId,
      createdAt: now,
      updatedAt: now,
      originType: 'initial',
      generationCount: 0,
      activeObservations: '',
      bufferedObservationChunks: [],
      observedMessageIds: [],
      observedTimezone: input.observedTimezone,
      totalTokensObserved: 0,
      observationTokenCount: 0,
      pendingMessageTokens: 0,
      isReflecting: false,
      isObserving: false,
      isBufferingObservation: false,
      isBufferingReflection: false,
      lastBufferedAtTokens: 0,
      lastBufferedAtTime: null,
      config: input.config,
    }

    await observationalMemoryRepo.create({
      data: {
        id: record.id,
        userId: input.resourceId,
        threadId: input.threadId,
        resourceId: input.resourceId,
        scope: input.scope,
        originType: record.originType,
        payload: observationPayload(record),
        createdAt: now,
        updatedAt: now,
      },
    })
    return record
  }

  async insertObservationalMemoryRecord(record: ObservationalMemoryRecord): Promise<void> {
    await observationalMemoryRepo.upsert({
      where: { id: record.id },
      create: {
        id: record.id,
        userId: record.resourceId,
        threadId: record.threadId,
        resourceId: record.resourceId,
        scope: record.scope,
        originType: record.originType,
        payload: observationPayload(record),
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
      update: {
        threadId: record.threadId,
        resourceId: record.resourceId,
        scope: record.scope,
        originType: record.originType,
        payload: observationPayload({ ...record, updatedAt: new Date() }),
      },
    })
  }

  async updateActiveObservations(input: UpdateActiveObservationsInput): Promise<void> {
    const record = await this.getObservationById(input.id)
    const observedIds = new Set(record.observedMessageIds ?? [])
    for (const id of input.observedMessageIds ?? []) observedIds.add(id)

    await this.saveObservation({
      ...record,
      activeObservations: appendText(record.activeObservations, input.observations),
      lastObservedAt: input.lastObservedAt,
      observedMessageIds: Array.from(observedIds),
      observedTimezone: input.observedTimezone ?? record.observedTimezone,
      totalTokensObserved: record.totalTokensObserved + input.tokenCount,
      observationTokenCount: record.observationTokenCount + input.tokenCount,
      pendingMessageTokens: 0,
    })
  }

  async updateBufferedObservations(input: UpdateBufferedObservationsInput): Promise<void> {
    const record = await this.getObservationById(input.id)
    const chunk = toBufferedChunk(input.chunk)
    const chunks = [...(record.bufferedObservationChunks ?? []), chunk]
    await this.saveObservation({
      ...record,
      bufferedObservationChunks: chunks,
      bufferedObservations: appendText(record.bufferedObservations ?? '', chunk.observations),
      bufferedObservationTokens: (record.bufferedObservationTokens ?? 0) + chunk.tokenCount,
      bufferedMessageIds: [...(record.bufferedMessageIds ?? []), ...chunk.messageIds],
      lastBufferedAtTime: input.lastBufferedAtTime ?? chunk.lastObservedAt,
    })
  }

  async swapBufferedToActive(
    input: SwapBufferedToActiveInput,
  ): Promise<SwapBufferedToActiveResult> {
    const record = await this.getObservationById(input.id)
    const chunks = input.bufferedChunks ?? record.bufferedObservationChunks ?? []
    if (chunks.length === 0) {
      return {
        chunksActivated: 0,
        messageTokensActivated: 0,
        observationTokensActivated: 0,
        messagesActivated: 0,
        activatedCycleIds: [],
        activatedMessageIds: [],
      }
    }

    const activated = this.selectBufferedChunks(chunks, input)
    const activatedIds = new Set(activated.map((chunk) => chunk.cycleId))
    const remaining = chunks.filter((chunk) => !activatedIds.has(chunk.cycleId))
    const observations = activated.map((chunk) => chunk.observations).join('\n')
    const activatedMessageIds = activated.flatMap((chunk) => chunk.messageIds)
    const observedIds = new Set(record.observedMessageIds ?? [])
    for (const id of activatedMessageIds) observedIds.add(id)
    const observationTokensActivated = activated.reduce((sum, chunk) => sum + chunk.tokenCount, 0)

    await this.saveObservation({
      ...record,
      activeObservations: appendText(record.activeObservations, observations),
      bufferedObservationChunks: remaining,
      bufferedObservations: remaining.map((chunk) => chunk.observations).join('\n'),
      bufferedObservationTokens: remaining.reduce((sum, chunk) => sum + chunk.tokenCount, 0),
      bufferedMessageIds: remaining.flatMap((chunk) => chunk.messageIds),
      observedMessageIds: Array.from(observedIds),
      lastObservedAt:
        input.lastObservedAt ??
        activated[activated.length - 1]?.lastObservedAt ??
        record.lastObservedAt,
      totalTokensObserved: record.totalTokensObserved + observationTokensActivated,
      observationTokenCount: record.observationTokenCount + observationTokensActivated,
      pendingMessageTokens: Math.max(
        input.currentPendingTokens - activated.reduce((sum, chunk) => sum + chunk.messageTokens, 0),
        0,
      ),
      lastBufferedAtTime: remaining.length > 0 ? record.lastBufferedAtTime : null,
    })

    return {
      chunksActivated: activated.length,
      messageTokensActivated: activated.reduce((sum, chunk) => sum + chunk.messageTokens, 0),
      observationTokensActivated,
      messagesActivated: activatedMessageIds.length,
      activatedCycleIds: activated.map((chunk) => chunk.cycleId),
      activatedMessageIds,
      observations,
      perChunk: activated.map((chunk) => ({
        cycleId: chunk.cycleId,
        messageTokens: chunk.messageTokens,
        observationTokens: chunk.tokenCount,
        messageCount: chunk.messageIds.length,
        observations: chunk.observations,
      })),
      suggestedContinuation: activated[activated.length - 1]?.suggestedContinuation,
      currentTask: activated[activated.length - 1]?.currentTask,
    }
  }

  async updateBufferedReflection(input: UpdateBufferedReflectionInput): Promise<void> {
    const record = await this.getObservationById(input.id)
    await this.saveObservation({
      ...record,
      bufferedReflection: input.reflection,
      bufferedReflectionTokens: input.tokenCount,
      bufferedReflectionInputTokens: input.inputTokenCount,
      reflectedObservationLineCount: input.reflectedObservationLineCount,
    })
  }

  async swapBufferedReflectionToActive(
    input: SwapBufferedReflectionToActiveInput,
  ): Promise<ObservationalMemoryRecord> {
    const current = await this.getObservationById(input.currentRecord.id)
    const lines = current.activeObservations.split('\n')
    const reflectedLineCount = current.reflectedObservationLineCount ?? lines.length
    const unreflected = lines.slice(reflectedLineCount).join('\n')
    const activeObservations = appendText(current.bufferedReflection ?? '', unreflected)
    return this.createReflectionGeneration({
      currentRecord: current,
      reflection: activeObservations,
      tokenCount: input.tokenCount,
    })
  }

  async createReflectionGeneration(
    input: CreateReflectionGenerationInput,
  ): Promise<ObservationalMemoryRecord> {
    const now = new Date()
    const current = input.currentRecord
    const next: ObservationalMemoryRecord = {
      ...current,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      originType: 'reflection',
      generationCount: current.generationCount + 1,
      activeObservations: input.reflection,
      bufferedObservationChunks: [],
      bufferedObservations: '',
      bufferedObservationTokens: 0,
      bufferedMessageIds: [],
      bufferedReflection: undefined,
      bufferedReflectionTokens: undefined,
      bufferedReflectionInputTokens: undefined,
      reflectedObservationLineCount: undefined,
      observedMessageIds: [],
      observationTokenCount: input.tokenCount,
      pendingMessageTokens: 0,
      isReflecting: false,
      isBufferingReflection: false,
      lastBufferedAtTokens: 0,
      lastBufferedAtTime: null,
    }
    await this.insertObservationalMemoryRecord(next)
    return next
  }

  async setReflectingFlag(id: string, isReflecting: boolean): Promise<void> {
    const record = await this.getObservationById(id)
    await this.saveObservation({ ...record, isReflecting })
  }

  async setObservingFlag(id: string, isObserving: boolean): Promise<void> {
    const record = await this.getObservationById(id)
    await this.saveObservation({ ...record, isObserving })
  }

  async setBufferingObservationFlag(
    id: string,
    isBufferingObservation: boolean,
    lastBufferedAtTokens?: number,
  ): Promise<void> {
    const record = await this.getObservationById(id)
    await this.saveObservation({
      ...record,
      isBufferingObservation,
      lastBufferedAtTokens: lastBufferedAtTokens ?? record.lastBufferedAtTokens,
    })
  }

  async setBufferingReflectionFlag(id: string, isBufferingReflection: boolean): Promise<void> {
    const record = await this.getObservationById(id)
    await this.saveObservation({ ...record, isBufferingReflection })
  }

  async clearObservationalMemory(threadId: string | null, resourceId: string): Promise<void> {
    await observationalMemoryRepo.deleteMany({
      where: {
        resourceId,
        ...(threadId ? { threadId } : { threadId: null }),
      },
    })
  }

  async setPendingMessageTokens(id: string, tokenCount: number): Promise<void> {
    const record = await this.getObservationById(id)
    await this.saveObservation({ ...record, pendingMessageTokens: tokenCount })
  }

  async updateObservationalMemoryConfig(
    input: UpdateObservationalMemoryConfigInput,
  ): Promise<void> {
    const record = await this.getObservationById(input.id)
    await this.saveObservation({
      ...record,
      config: this.deepMergeConfig(record.config, input.config),
    })
  }

  private async getObservationById(id: string): Promise<ObservationalMemoryRecord> {
    const row = await observationalMemoryRepo.findUnique({ where: { id } })
    if (!row) throw new Error(`Observational memory record not found: ${id}`)
    return observationToMastra(row)
  }

  private async saveObservation(record: ObservationalMemoryRecord): Promise<void> {
    const updatedAt = new Date()
    await observationalMemoryRepo.update({
      where: { id: record.id },
      data: {
        threadId: record.threadId,
        resourceId: record.resourceId,
        scope: record.scope,
        originType: record.originType,
        payload: observationPayload({ ...record, updatedAt }),
      },
    })
  }

  private selectBufferedChunks(
    chunks: BufferedObservationChunk[],
    input: SwapBufferedToActiveInput,
  ): BufferedObservationChunk[] {
    if (input.forceMaxActivation) return chunks
    const retentionFloor = input.messageTokensThreshold * (1 - input.activationRatio)
    const targetTokens = Math.max(input.currentPendingTokens - retentionFloor, 0)
    if (targetTokens <= 0) return []

    const selected: BufferedObservationChunk[] = []
    let selectedTokens = 0
    for (const chunk of chunks) {
      selected.push(chunk)
      selectedTokens += chunk.messageTokens
      if (selectedTokens >= targetTokens) break
    }
    return selected
  }
}

export class MastraStorage extends MastraCompositeStore {
  constructor() {
    super({
      id: 'mastra-storage',
      name: 'Mastra Storage',
      domains: {
        memory: new MastraMemoryStorage(),
      },
    })
  }
}
