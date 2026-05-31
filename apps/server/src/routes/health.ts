import { Hono } from 'hono'

export const healthRouter = new Hono().get('/health', (c) =>
  c.json({ status: 'ok', time: new Date().toISOString() }),
)
