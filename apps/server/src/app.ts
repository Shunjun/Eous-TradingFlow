import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { healthRouter } from './routes/health.js'
import { authRouter } from './routes/auth.js'

export const app = new Hono()

app.use('*', cors({ origin: 'http://localhost:5173', credentials: true }))

app.route('/api', healthRouter)
app.route('/api/auth', authRouter)
