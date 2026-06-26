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
import { MastraStorage } from './mastra-storage.js'

const mastraStorage = new MastraStorage()

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

export class MastraRuntimeMemory extends MastraMemory {
  constructor() {
    super({
      name: 'Mastra Runtime Memory',
      storage: mastraStorage,
      options: {
        lastMessages: 20,
        semanticRecall: false,
        workingMemory: {
          enabled: true,
          scope: 'resource',
        },
        observationalMemory: {
          scope: 'resource',
        },
      },
    })
  }

  private async memoryStore() {
    const store = await mastraStorage.getStore('memory')
    if (!store) throw new Error('Mastra memory storage is not configured')
    return store
  }

  async getThreadById(args: {
    threadId: string
    resourceId?: string
  }): Promise<StorageThreadType | null> {
    return (await this.memoryStore()).getThreadById(args)
  }

  async listThreads(args: StorageListThreadsInput): Promise<StorageListThreadsOutput> {
    return (await this.memoryStore()).listThreads(args)
  }

  async saveThread(args: {
    thread: StorageThreadType
    memoryConfig?: MemoryConfigInternal
  }): Promise<StorageThreadType> {
    return (await this.memoryStore()).saveThread({ thread: args.thread })
  }

  async updateThread(args: {
    id: string
    title: string
    metadata: Record<string, unknown>
    memoryConfig?: MemoryConfigInternal
  }): Promise<StorageThreadType> {
    return (await this.memoryStore()).updateThread(args)
  }

  async deleteThread(threadId: string): Promise<void> {
    await (await this.memoryStore()).deleteThread({ threadId })
  }

  async saveMessages(args: {
    messages: MastraDBMessage[]
    memoryConfig?: MemoryConfig | undefined
    observabilityContext?: Partial<ObservabilityContext>
  }): Promise<{ messages: MastraDBMessage[] }> {
    return (await this.memoryStore()).saveMessages({ messages: args.messages })
  }

  async recall(
    args: StorageListMessagesInput & {
      threadConfig?: MemoryConfigInternal
      vectorSearchString?: string
      includeSystemReminders?: boolean
      observabilityContext?: Partial<ObservabilityContext>
    },
  ): Promise<StorageListMessagesOutput> {
    return (await this.memoryStore()).listMessages({
      ...args,
      perPage: args.perPage ?? args.threadConfig?.lastMessages ?? 20,
    })
  }

  async deleteMessages(messageIds: MessageDeleteInput): Promise<void> {
    await (await this.memoryStore()).deleteMessages(normalizeMessageIds(messageIds))
  }

  async getWorkingMemory({
    resourceId,
  }: {
    threadId: string
    resourceId?: string
    memoryConfig?: MemoryConfigInternal
  }): Promise<string | null> {
    if (!resourceId) return null
    const resource = await (await this.memoryStore()).getResourceById({ resourceId })
    return resource?.workingMemory ?? null
  }

  async getWorkingMemoryTemplate(): Promise<WorkingMemoryTemplate | null> {
    return null
  }

  async updateWorkingMemory({
    resourceId,
    workingMemory,
  }: {
    threadId: string
    resourceId?: string
    workingMemory: string
    memoryConfig?: MemoryConfigInternal
    observabilityContext?: Partial<ObservabilityContext>
  }): Promise<void> {
    if (!resourceId) return
    await (await this.memoryStore()).updateResource({ resourceId, workingMemory })
  }

  async __experimental_updateWorkingMemoryVNext({
    resourceId,
    workingMemory,
  }: {
    threadId: string
    resourceId?: string
    workingMemory: string
    searchString?: string
    memoryConfig?: MemoryConfigInternal
  }): Promise<{ success: boolean; reason: string }> {
    if (!resourceId) return { success: false, reason: 'resourceId is required' }
    await (await this.memoryStore()).updateResource({ resourceId, workingMemory })
    return { success: true, reason: 'working memory updated' }
  }

  async cloneThread(args: StorageCloneThreadInput): Promise<StorageCloneThreadOutput> {
    return (await this.memoryStore()).cloneThread(args)
  }
}

export const mastraMemory = new MastraRuntimeMemory()
