import { serve } from '@hono/node-server'
import { app } from './app.js'
import { prisma } from '@eous/db'
import { seedInitialUser } from './lib/seed.js'
import { migrateWorkspaceLayouts } from './lib/migrate-workspace.js'
import { registerDataSourceProvider } from '@eous/data-sources'
import { YahooFinanceProvider } from '@eous/data-sources/providers/yahoo-finance'
import { CCXTProvider } from '@eous/data-sources/providers/ccxt'

async function main() {
  await prisma.$connect()
  console.log('[db] connected')

  registerDataSourceProvider(new YahooFinanceProvider())
  registerDataSourceProvider(new CCXTProvider())
  console.log('[data-sources] registered: yahoo-finance, ccxt')

  await seedInitialUser()
  await migrateWorkspaceLayouts()

  serve({ fetch: app.fetch, port: parseInt(process.env.PORT || '3001', 10) }, (info) => {
    console.log(`[server] ready on http://localhost:${info.port}`)
  })
}

main().catch((err) => {
  console.error('[server] failed to start:', err)
  process.exit(1)
})
