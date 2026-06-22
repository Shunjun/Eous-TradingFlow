import type { Server as HttpServer } from 'node:http'
import { serve } from '@hono/node-server'
import { app } from './app.js'
import { prisma } from '@eous/db'
import { seedInitialUser } from './lib/seed.js'
import { migrateWorkspaceLayouts } from './lib/migrate-workspace.js'
import { registerDataSourceProvider } from '@eous/data-sources'
import { YahooFinanceProvider } from '@eous/data-sources/providers/yahoo-finance'
import { CCXTProvider } from '@eous/data-sources/providers/ccxt'
import { installMarketDataSocket } from './ws/market-data-socket.js'

function formatListenAddress(address: string): string {
  if (address === '::' || address === '0.0.0.0') return '0.0.0.0'
  return address.includes(':') ? `[${address}]` : address
}

async function main() {
  await prisma.$connect()
  console.log('[db] connected')

  registerDataSourceProvider(new YahooFinanceProvider())
  registerDataSourceProvider(new CCXTProvider())
  console.log('[data-sources] registered: yahoo-finance, ccxt')

  await seedInitialUser()
  await migrateWorkspaceLayouts()

  const server = serve(
    { fetch: app.fetch, port: parseInt(process.env.PORT || '3001', 10) },
    (info) => {
      console.log(`[server] ready on http://${formatListenAddress(info.address)}:${info.port}`)
    },
  )
  installMarketDataSocket(server as HttpServer)
}

main().catch((err) => {
  console.error('[server] failed to start:', err)
  process.exit(1)
})
