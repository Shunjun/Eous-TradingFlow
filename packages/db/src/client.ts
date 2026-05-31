import { PrismaClient } from "./generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve data directory relative to project root
// packages/db/src → packages/db → project root
const projectRoot = path.resolve(__dirname, "../..");
const dbPath = path.resolve(projectRoot, "data", "dev.db");

// Ensure data directory exists
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const adapter = new PrismaBetterSqlite3({ url: dbPath });

export const prisma: PrismaClient = new PrismaClient({ adapter });
