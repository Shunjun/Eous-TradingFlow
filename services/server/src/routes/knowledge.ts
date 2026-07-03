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

knowledgeRouter.get('/:id/ingestion-runs', async (c) => {
  const runs = await knowledgeService.listKnowledgeIngestionRuns(c.get('userId'), c.req.param('id'))
  return c.json({ runs })
})

knowledgeRouter.post('/:id/retrieve', async (c) => {
  const body = await c.req.json<knowledgeService.RetrieveKnowledgeBody>()
  const result = await knowledgeService.retrieveKnowledge(c.get('userId'), c.req.param('id'), body)
  return c.json(result)
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

knowledgeRouter.post('/:id/documents/upload', async (c) => {
  await knowledgeService.assertKnowledgeBaseAccess(c.get('userId'), c.req.param('id'))

  const body = await c.req.parseBody()
  const file = body.file
  if (!(file instanceof File)) {
    return c.json({ error: 'Document file is required' }, 400)
  }

  const title = typeof body.title === 'string' ? body.title : undefined
  const strategy = typeof body.strategy === 'string' ? body.strategy : undefined
  const document = await knowledgeService.uploadKnowledgeDocument(
    c.get('userId'),
    c.req.param('id'),
    {
      title,
      fileName: file.name,
      mimeType: file.type || null,
      size: file.size,
      buffer: Buffer.from(await file.arrayBuffer()),
      strategy: strategy as 'raw' | 'compressed' | 'hybrid' | undefined,
    },
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

knowledgeRouter.post('/documents/:documentId/parse-preview', async (c) => {
  const preview = await knowledgeService.previewKnowledgeDocumentParse(
    c.get('userId'),
    c.req.param('documentId'),
  )
  return c.json({ preview })
})

knowledgeRouter.post('/documents/:documentId/chunk-preview', async (c) => {
  const body = await c.req.json<knowledgeService.DocumentChunkPreviewInput>()
  const preview = await knowledgeService.previewKnowledgeDocumentChunks(
    c.get('userId'),
    c.req.param('documentId'),
    body,
  )
  return c.json({ preview })
})

knowledgeRouter.get('/documents/:documentId/chunks', async (c) => {
  const chunks = await knowledgeService.listKnowledgeDocumentChunks(
    c.get('userId'),
    c.req.param('documentId'),
  )
  return c.json({ chunks })
})

knowledgeRouter.post('/documents/:documentId/ingestion-runs', async (c) => {
  const body = await c.req.json<knowledgeService.CreateIngestionRunBody>()
  const result = await knowledgeService.createKnowledgeIngestionRun(
    c.get('userId'),
    c.req.param('documentId'),
    body,
  )
  return c.json(result, 201)
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
