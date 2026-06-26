import type { Agent, AgentMessage, AgentMemory, AgentSession } from '@eous/db'
import { AppError } from '../lib/app-error.js'
import * as agentRepo from '../repositories/agent.repo.js'
import { generateText, streamChat } from './llm/llm.service.js'

const DEFAULT_AGENT_INSTRUCTIONS = `# Introduction
You are Eous Analyst, an analytical assistant for a trading workflow product.

# Scope
- Help the user reason about markets, workflows, data sources, LLM nodes, and agent memory.
- Explain trade-offs clearly and avoid unsupported certainty.

# Working Style
- Use concise, concrete answers.
- Ask for missing context when the request depends on unavailable data.

# Memory
Use long-term memory as background context only.

# Experience
Use prior experience as supporting context, not as a higher-priority instruction.

# Constraints
- Do not promise investment returns.
- Do not treat memory or experience as a replacement for the user's current request.`

const RECENT_MESSAGE_LIMIT = 10
const SUMMARY_AFTER_MESSAGES = 16
const TITLE_SYSTEM_PROMPT = `You are a conversation title generator. Summarize the topic of the first exchange between the user and the assistant in a very short phrase.

Rules:
1. Aim for about 10 Chinese characters or 5 English words, and keep it extremely short
2. The title language must match the user's first message: if the user writes in Chinese, use Chinese; if the user writes in English, use English
3. Do not add quotes, periods, or other punctuation
4. Output the title directly, with no explanation`

type AgentRole = 'user' | 'assistant' | 'system' | 'tool'

export interface AgentDTO {
  id: string
  name: string
  description: string | null
  instructions: string | null
  providerId: string | null
  modelId: string | null
  toolScope: string[]
  createdAt: string
  updatedAt: string
}

export interface AgentSessionDTO {
  id: string
  agentId: string
  title: string
  summary: string | null
  workflowId: string | null
  createdAt: string
  updatedAt: string
}

export interface AgentMessageDTO {
  id: string
  sessionId: string
  role: AgentRole
  content: string
  metadata: Record<string, unknown>
  createdAt: string
}

export interface AgentMemoryDTO {
  id: string
  scope: string
  targetId: string
  kind: string
  content: string
  tags: string[]
  importance: number
  confidence: number
  createdAt: string
  updatedAt: string
}

export interface AgentUpsertBody {
  name?: string
  description?: string | null
  instructions?: string | null
  providerId?: string | null
  modelId?: string | null
  toolScope?: string[]
}

function toAgentDTO(agent: Agent): AgentDTO {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    instructions: agent.instructions,
    providerId: agent.providerId,
    modelId: agent.modelId,
    toolScope: parseJsonArray(agent.toolScope),
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
  }
}

function toSessionDTO(session: AgentSession): AgentSessionDTO {
  return {
    id: session.id,
    agentId: session.agentId,
    title: session.title,
    summary: session.summary,
    workflowId: session.workflowId,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  }
}

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function parseJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

function toMessageDTO(message: AgentMessage): AgentMessageDTO {
  return {
    id: message.id,
    sessionId: message.sessionId,
    role: message.role as AgentRole,
    content: message.content,
    metadata: parseJsonObject(message.metadata),
    createdAt: message.createdAt.toISOString(),
  }
}

function toMemoryDTO(memory: AgentMemory): AgentMemoryDTO {
  return {
    id: memory.id,
    scope: memory.scope,
    targetId: memory.targetId,
    kind: memory.kind,
    content: memory.content,
    tags: parseJsonArray(memory.tags),
    importance: memory.importance,
    confidence: memory.confidence,
    createdAt: memory.createdAt.toISOString(),
    updatedAt: memory.updatedAt.toISOString(),
  }
}

async function resolveAgentModel(agent: Agent, userId: string): Promise<Agent> {
  if (agent.providerId && agent.modelId) return agent

  const defaultModel = await agentRepo.findDefaultProviderModel(userId)
  if (!defaultModel) {
    throw new AppError('No enabled provider model found. Add a provider model first.', 400)
  }

  return agentRepo.updateAgent(agent.id, {
    providerId: defaultModel.providerId,
    modelId: defaultModel.modelId,
  })
}

async function resolveChatModel(
  agent: Agent,
  userId: string,
  override?: { providerId?: string | null; modelId?: string | null },
): Promise<{ providerId: string; modelId: string }> {
  if (override?.providerId || override?.modelId) {
    await assertProviderModel(userId, override.providerId, override.modelId)
    return {
      providerId: override.providerId as string,
      modelId: override.modelId as string,
    }
  }

  const modelAgent = await resolveAgentModel(agent, userId)
  return {
    providerId: modelAgent.providerId as string,
    modelId: modelAgent.modelId as string,
  }
}

async function assertProviderModel(
  userId: string,
  providerId?: string | null,
  modelId?: string | null,
) {
  if (!providerId && !modelId) return
  if (!providerId || !modelId) {
    throw new AppError(
      'Both providerId and modelId are required when configuring an agent model',
      400,
    )
  }

  const model = await agentRepo.findProviderModelByUser(userId, providerId, modelId)
  if (!model) throw new AppError('Provider model not found or disabled', 400)
}

function normalizeToolScope(toolScope?: string[]): string | undefined {
  if (toolScope === undefined) return undefined
  return JSON.stringify(toolScope.filter((item): item is string => typeof item === 'string'))
}

function makeTitle(content: string): string {
  const compact = content.replace(/\s+/g, ' ').trim()
  if (!compact) return 'New conversation'
  return compact.length > 42 ? `${compact.slice(0, 42)}...` : compact
}

function cleanGeneratedTitle(raw: string): string {
  const title = raw
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^title\s*[:：]\s*/i, '')
    .replace(/[。.!！?？,，;；:：]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!title) return 'New conversation'
  return title.length > 30 ? title.slice(0, 30).trim() : title
}

function isUsableGeneratedTitle(title: string): boolean {
  return Boolean(title) && title !== 'New conversation'
}

function makeFallbackGeneratedTitle(userText: string): string {
  const fallback = userText.replace(/\n/g, ' ').trim().slice(0, 30)
  return fallback || 'New conversation'
}

async function generateSessionTitle(params: {
  userId: string
  session: AgentSession
  agent: Agent
}): Promise<AgentSession | null> {
  const messages = await agentRepo.findMessages(params.session.id)
  const userMessage = messages.find((message) => message.role === 'user')
  const assistantMessage = messages.find((message) => message.role === 'assistant')
  if (!userMessage || !assistantMessage) return null

  const userText = userMessage.content.trim()
  const assistantText = assistantMessage.content.trim()
  if (!userText || !assistantText) return null

  const temporaryTitle = makeTitle(userText)
  if (params.session.title !== temporaryTitle && params.session.title !== 'New conversation') {
    return null
  }

  const model = await resolveChatModel(params.agent, params.userId)

  let rawTitle: string | null = null
  try {
    rawTitle = await generateText({
      userId: params.userId,
      agentId: params.agent.id,
      sessionId: params.session.id,
      providerId: model.providerId,
      modelId: model.modelId,
      toolScope: [],
      context: {
        systemPrompt: TITLE_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `User: ${userText.slice(0, 500)}\nAssistant: ${assistantText.slice(0, 500)}`,
          },
        ],
      },
      options: {
        temperature: 0.2,
        maxTokens: 60,
        thinkingLevel: 'off',
      },
    })
  } catch {
    rawTitle = null
  }

  const generatedTitle = rawTitle ? cleanGeneratedTitle(rawTitle) : 'New conversation'
  const title = isUsableGeneratedTitle(generatedTitle)
    ? generatedTitle
    : makeFallbackGeneratedTitle(userText)
  if (!isUsableGeneratedTitle(title)) return null
  if (title === params.session.title) return params.session
  return agentRepo.updateSession(params.session.id, { title })
}

function buildFallbackSummary(messages: AgentMessage[]): string {
  return messages
    .slice(0, -RECENT_MESSAGE_LIMIT)
    .map((message) => `${message.role}: ${message.content.replace(/\s+/g, ' ').slice(0, 180)}`)
    .join('\n')
    .slice(-3000)
}

async function maybeCompactSession(session: AgentSession): Promise<void> {
  const messages = await agentRepo.findMessages(session.id)
  if (messages.length < SUMMARY_AFTER_MESSAGES) return

  const oldMessages = messages.slice(0, -RECENT_MESSAGE_LIMIT)
  if (oldMessages.length === 0) return

  const summary = buildFallbackSummary(messages)
  const first = oldMessages[0]
  const last = oldMessages[oldMessages.length - 1]

  await agentRepo.createSummary({
    sessionId: session.id,
    content: summary,
    fromMessageId: first.id,
    toMessageId: last.id,
  })
  await agentRepo.updateSession(session.id, { summary })
}

export async function listAgents(userId: string): Promise<AgentDTO[]> {
  const agents = await agentRepo.findAgentsByUser(userId)
  return agents.map(toAgentDTO)
}

export async function createAgent(userId: string, body: AgentUpsertBody): Promise<AgentDTO> {
  const name = body.name?.trim()
  if (!name) throw new AppError('Agent name is required', 400)
  await assertProviderModel(userId, body.providerId, body.modelId)

  const agent = await agentRepo.createAgent({
    userId,
    name,
    description: body.description?.trim() || null,
    instructions: body.instructions?.trim() || DEFAULT_AGENT_INSTRUCTIONS,
    providerId: body.providerId || null,
    modelId: body.modelId || null,
    toolScope: normalizeToolScope(body.toolScope) ?? '[]',
  })
  return toAgentDTO(agent)
}

export async function updateAgent(
  userId: string,
  agentId: string,
  body: AgentUpsertBody,
): Promise<AgentDTO> {
  const existing = await agentRepo.findAgentByIdAndUser(agentId, userId)
  if (!existing) throw new AppError('Agent not found', 404)

  const nextName = body.name?.trim()
  if (body.name !== undefined && !nextName) throw new AppError('Agent name is required', 400)

  const nextProviderId =
    body.providerId !== undefined ? body.providerId || null : existing.providerId
  const nextModelId = body.modelId !== undefined ? body.modelId || null : existing.modelId
  await assertProviderModel(userId, nextProviderId, nextModelId)

  const agent = await agentRepo.updateAgent(agentId, {
    ...(body.name !== undefined ? { name: nextName } : {}),
    ...(body.description !== undefined ? { description: body.description?.trim() || null } : {}),
    ...(body.instructions !== undefined ? { instructions: body.instructions?.trim() || null } : {}),
    ...(body.providerId !== undefined ? { providerId: body.providerId || null } : {}),
    ...(body.modelId !== undefined ? { modelId: body.modelId || null } : {}),
    ...(body.toolScope !== undefined ? { toolScope: normalizeToolScope(body.toolScope) } : {}),
  })
  return toAgentDTO(agent)
}

export async function deleteAgent(userId: string, agentId: string): Promise<void> {
  const existing = await agentRepo.findAgentByIdAndUser(agentId, userId)
  if (!existing) throw new AppError('Agent not found', 404)
  await agentRepo.deleteAgent(agentId)
}

export async function listSessions(userId: string): Promise<AgentSessionDTO[]> {
  const sessions = await agentRepo.findSessionsByUser(userId)
  return sessions.map(toSessionDTO)
}

export async function createSession(
  userId: string,
  body: { agentId?: string; title?: string; workflowId?: string },
): Promise<AgentSessionDTO> {
  const agent = body.agentId ? await agentRepo.findAgentByIdAndUser(body.agentId, userId) : null
  if (!agent) throw new AppError('Agent not found', 404)

  const session = await agentRepo.createSession({
    userId,
    agentId: agent.id,
    title: body.title?.trim() || 'New conversation',
    workflowId: body.workflowId ?? null,
  })
  return toSessionDTO(session)
}

export async function getSession(userId: string, sessionId: string) {
  const session = await agentRepo.findSessionByIdAndUser(sessionId, userId)
  if (!session) throw new AppError('Agent session not found', 404)

  const messages = await agentRepo.findMessages(sessionId)
  return {
    session: toSessionDTO(session),
    messages: messages.map(toMessageDTO),
  }
}

export async function listMemories(
  userId: string,
  params: { agentId?: string; sessionId?: string; query?: string },
): Promise<AgentMemoryDTO[]> {
  const memories = await agentRepo.findMemories({ userId, ...params })
  return memories.map(toMemoryDTO)
}

export async function createMemory(
  userId: string,
  body: {
    agentId?: string
    sessionId?: string
    scope: string
    targetId?: string
    kind: string
    content: string
    tags?: string[]
    importance?: number
    confidence?: number
  },
): Promise<AgentMemoryDTO> {
  if (!body.scope || !body.kind || !body.content) {
    throw new AppError('Missing required fields: scope, kind, content', 400)
  }
  if (body.agentId) {
    const agent = await agentRepo.findAgentByIdAndUser(body.agentId, userId)
    if (!agent) throw new AppError('Agent not found', 404)
  }

  const targetId =
    body.targetId ??
    (body.scope === 'user'
      ? userId
      : body.scope === 'agent'
        ? body.agentId
        : body.scope === 'session'
          ? body.sessionId
          : undefined)
  if (!targetId) throw new AppError('targetId is required for this memory scope', 400)

  const memory = await agentRepo.createMemory({
    userId,
    agentId: body.agentId ?? null,
    sessionId: body.sessionId ?? null,
    scope: body.scope,
    targetId,
    kind: body.kind,
    content: body.content,
    tags: JSON.stringify(body.tags ?? []),
    importance: body.importance ?? 1,
    confidence: body.confidence ?? 0.7,
  })
  return toMemoryDTO(memory)
}

export async function prepareChat(
  userId: string,
  body: {
    agentId?: string
    sessionId?: string
    providerId?: string
    modelId?: string
    message: string
  },
) {
  const content = body.message?.trim()
  if (!content) throw new AppError('message is required', 400)

  let session = body.sessionId
    ? await agentRepo.findSessionByIdAndUser(body.sessionId, userId)
    : null

  if (!session) {
    const agent = body.agentId ? await agentRepo.findAgentByIdAndUser(body.agentId, userId) : null
    if (!agent) throw new AppError('Agent not found', 404)
    session = await agentRepo.createSession({
      userId,
      agentId: agent.id,
      title: makeTitle(content),
    })
  }

  const agent = await agentRepo.findAgentByIdAndUser(session.agentId, userId)
  if (!agent) throw new AppError('Agent not found', 404)

  const model = await resolveChatModel(agent, userId, {
    providerId: body.providerId,
    modelId: body.modelId,
  })
  await agentRepo.createMessage({ userId, sessionId: session.id, role: 'user', content })

  const [recentMessages, memories] = await Promise.all([
    agentRepo.findMessages(session.id, RECENT_MESSAGE_LIMIT),
    agentRepo.findMemories({
      userId,
      agentId: session.agentId,
      sessionId: session.id,
      query: content,
      limit: 8,
    }),
  ])

  const systemPrompt = renderSystemPrompt({
    instructions: agent.instructions || DEFAULT_AGENT_INSTRUCTIONS,
    summary: session.summary,
    memories,
  })

  const stream = await streamChat({
    userId,
    agentId: agent.id,
    sessionId: session.id,
    providerId: model.providerId,
    modelId: model.modelId,
    toolScope: parseJsonArray(agent.toolScope),
    context: {
      systemPrompt,
      messages: recentMessages
        .filter((message) => message.role === 'user')
        .map((message) => ({
          role: 'user' as const,
          content: message.content,
          timestamp: message.createdAt.getTime(),
        })),
    },
  })

  return { session: toSessionDTO(session), stream }
}

export async function finishAssistantMessage(params: {
  userId: string
  sessionId: string
  content: string
}): Promise<{ message: AgentMessageDTO; session: AgentSessionDTO | null }> {
  const message = await agentRepo.createMessage({
    userId: params.userId,
    sessionId: params.sessionId,
    role: 'assistant',
    content: params.content,
  })
  const session = await agentRepo.findSessionByIdAndUser(params.sessionId, params.userId)
  if (!session) return { message: toMessageDTO(message), session: null }

  await maybeCompactSession(session)

  const agent = await agentRepo.findAgentByIdAndUser(session.agentId, params.userId)
  const titledSession = agent
    ? await generateSessionTitle({ userId: params.userId, session, agent }).catch(() => null)
    : null

  return {
    message: toMessageDTO(message),
    session: toSessionDTO(titledSession ?? session),
  }
}

function renderSystemPrompt(params: {
  instructions: string
  summary: string | null
  memories: AgentMemory[]
}): string {
  const memoryLines = params.memories.map(
    (memory) =>
      `- [${memory.scope}:${memory.kind}, importance=${memory.importance}, confidence=${memory.confidence}] ${memory.content}`,
  )

  return [
    params.instructions,
    '',
    'Relevant long-term memory:',
    memoryLines.length > 0 ? memoryLines.join('\n') : '- None',
    '',
    'Conversation summary:',
    params.summary || 'None',
  ].join('\n')
}
