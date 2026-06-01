import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { healthRouter } from './routes/health.js'
import { authRouter } from './routes/auth.js'
import { providerRouter, templatesRouter } from './routes/provider.js'
import { dataSourceRouter, dataSourceInstanceRouter } from './routes/data-source.js'

export const app = new Hono()

app.use('*', cors({ origin: 'http://localhost:5173', credentials: true }))

app.route('/api', healthRouter)
app.route('/api/auth', authRouter)
app.route('/api/providers', providerRouter)
app.route('/api/provider-templates', templatesRouter)
app.route('/api', dataSourceRouter)
app.route('/api', dataSourceInstanceRouter)
