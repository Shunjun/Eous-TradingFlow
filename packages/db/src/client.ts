import { PrismaClient } from './generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://eous:eous_password@localhost:5432/eous_tradingflow?schema=public'
const adapter = new PrismaPg({ connectionString })

export const prisma: PrismaClient = new PrismaClient({ adapter })
