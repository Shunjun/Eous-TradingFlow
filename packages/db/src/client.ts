import { PrismaClient } from "./generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { resolveDbUrl } from "./resolve-db-url.js";

const dbUrl = resolveDbUrl(process.env.DATABASE_URL || "file:./data/dev.db");
const adapter = new PrismaBetterSqlite3({ url: dbUrl });

export const prisma: PrismaClient = new PrismaClient({ adapter });
