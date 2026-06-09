import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { healthRouter } from './routes/health.js'
import { authRouter } from './routes/auth.js'
import { providerRouter, templatesRouter } from './routes/provider.js'
import { dataSourceRouter, dataSourceInstanceRouter } from './routes/data-source.js'
import { workspaceRouter } from './routes/workspace.js'
import { workflowRouter } from './routes/workflow.js'
import { AppError } from './lib/app-error.js'

export const app = new Hono()

app.use('*', cors({ origin: 'http://localhost:5173', credentials: true }))

app.route('/api', healthRouter)
app.route('/api/auth', authRouter)
app.route('/api/providers', providerRouter)
app.route('/api/provider-templates', templatesRouter)
app.route('/api', dataSourceRouter)
app.route('/api', dataSourceInstanceRouter)
app.route('/api/workspace', workspaceRouter)
app.route('/api/workflows', workflowRouter)

app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: err.message }, err.statusCode as 400)
  }
  console.error('[server] unhandled error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})
