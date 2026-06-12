import { Hono } from 'hono'
import { authMiddleware } from '../lib/auth-middleware.js'
import * as agentService from '../services/agent.service.js'

export const agentRouter = new Hono()

agentRouter.use('*', authMiddleware)

function sse(type: string, data: unknown): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`
}

agentRouter.get('/', async (c) => {
  const agents = await agentService.listAgents(c.get('userId'))
  return c.json({ agents })
})

agentRouter.post('/', async (c) => {
  const body = await c.req.json<agentService.AgentUpsertBody>()
  const agent = await agentService.createAgent(c.get('userId'), body)
  return c.json({ agent }, 201)
})

agentRouter.patch('/:id', async (c) => {
  const body = await c.req.json<agentService.AgentUpsertBody>()
  const agent = await agentService.updateAgent(c.get('userId'), c.req.param('id'), body)
  return c.json({ agent })
})

agentRouter.get('/sessions', async (c) => {
  const sessions = await agentService.listSessions(c.get('userId'))
  return c.json({ sessions })
})

agentRouter.post('/sessions', async (c) => {
  const body = await c.req.json<{ agentId?: string; title?: string; workflowId?: string }>()
  const session = await agentService.createSession(c.get('userId'), body)
  return c.json({ session }, 201)
})

agentRouter.get('/sessions/:id', async (c) => {
  const result = await agentService.getSession(c.get('userId'), c.req.param('id'))
  return c.json(result)
})

agentRouter.get('/memories', async (c) => {
  const memories = await agentService.listMemories(c.get('userId'), {
    agentId: c.req.query('agentId'),
    sessionId: c.req.query('sessionId'),
    query: c.req.query('query'),
  })
  return c.json({ memories })
})

agentRouter.post('/memories', async (c) => {
  const body = await c.req.json<{
    agentId?: string
    sessionId?: string
    scope: string
    targetId?: string
    kind: string
    content: string
    tags?: string[]
    importance?: number
    confidence?: number
  }>()
  const memory = await agentService.createMemory(c.get('userId'), body)
  return c.json({ memory }, 201)
})

agentRouter.post('/chat', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json<{ agentId?: string; sessionId?: string; message: string }>()
  const { session, stream } = await agentService.prepareChat(userId, body)

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let fullText = ''

      const write = (type: string, data: unknown) => {
        controller.enqueue(encoder.encode(sse(type, data)))
      }

      write('session', { session })

      try {
        for await (const event of stream) {
          if (event.type === 'text_delta' && 'delta' in event) {
            fullText += event.delta
            write('text_delta', { delta: event.delta })
          } else if (event.type === 'error') {
            const error = 'error' in event ? event.error : 'LLM stream error'
            write('error', { error })
          }
        }

        const message = await agentService.finishAssistantMessage({
          userId,
          sessionId: session.id,
          content: fullText,
        })
        write('done', { message })
      } catch (err) {
        write('error', { error: err instanceof Error ? err.message : String(err) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
})
