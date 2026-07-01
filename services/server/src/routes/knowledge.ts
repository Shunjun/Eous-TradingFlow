import { Hono } from 'hono'
import { authMiddleware } from '../lib/auth-middleware.js'
import * as knowledgeService from '../modules/knowledge/index.js'

export const knowledgeRouter = new Hono()

knowledgeRouter.use('*', authMiddleware)

knowledgeRouter.get('/', async (c) => {
  const knowledgeBases = await knowledgeService.listKnowledgeBases(c.get('userId'))
  return c.json({ knowledgeBases })
})

knowledgeRouter.post('/', async (c) => {
  const body = await c.req.json<knowledgeService.CreateKnowledgeBaseBody>()
  const knowledgeBase = await knowledgeService.createKnowledgeBase(c.get('userId'), body)
  return c.json({ knowledgeBase }, 201)
})

knowledgeRouter.get('/:id/documents', async (c) => {
  const documents = await knowledgeService.listKnowledgeDocuments(
    c.get('userId'),
    c.req.param('id'),
  )
  return c.json({ documents })
})

knowledgeRouter.post('/:id/documents', async (c) => {
  const body = await c.req.json<knowledgeService.CreateKnowledgeDocumentBody>()
  const document = await knowledgeService.createKnowledgeDocument(
    c.get('userId'),
    c.req.param('id'),
    body,
  )
  return c.json({ document }, 201)
})

knowledgeRouter.post('/:id/chunk-preview', async (c) => {
  await knowledgeService.assertKnowledgeBaseAccess(c.get('userId'), c.req.param('id'))
  const body = await c.req.json<knowledgeService.ChunkPreviewInput>()
  const preview = knowledgeService.previewChunks(body)
  return c.json({ preview })
})

knowledgeRouter.delete('/documents/:documentId', async (c) => {
  await knowledgeService.deleteKnowledgeDocument(c.get('userId'), c.req.param('documentId'))
  return c.json({ ok: true })
})

knowledgeRouter.get('/:id', async (c) => {
  const knowledgeBase = await knowledgeService.getKnowledgeBase(c.get('userId'), c.req.param('id'))
  return c.json({ knowledgeBase })
})

knowledgeRouter.patch('/:id', async (c) => {
  const body = await c.req.json<knowledgeService.UpdateKnowledgeBaseBody>()
  const knowledgeBase = await knowledgeService.updateKnowledgeBase(
    c.get('userId'),
    c.req.param('id'),
    body,
  )
  return c.json({ knowledgeBase })
})

knowledgeRouter.delete('/:id', async (c) => {
  await knowledgeService.deleteKnowledgeBase(c.get('userId'), c.req.param('id'))
  return c.json({ ok: true })
})
