import { defineConfig } from 'prisma/config'

const dbUrl =
  process.env.DATABASE_URL ||
  'postgresql://eous:eous_password@localhost:5432/eous_tradingflow?schema=public'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: dbUrl,
  },
})
