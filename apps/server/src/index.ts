import { serve } from '@hono/node-server'
import { app } from './app.js'
import { prisma } from '@eous/db'
import { seedInitialUser } from './lib/seed.js'

async function main() {
  await prisma.$connect()
  console.log('[db] connected')

  await seedInitialUser()

  serve({ fetch: app.fetch, port: parseInt(process.env.PORT || '3001', 10) }, (info) => {
    console.log(`[server] ready on http://localhost:${info.port}`)
  })
}

main().catch((err) => {
  console.error('[server] failed to start:', err)
  process.exit(1)
})
