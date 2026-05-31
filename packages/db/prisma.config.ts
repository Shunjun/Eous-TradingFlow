import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { defineConfig } from "prisma/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve data directory relative to project root
// packages/db → project root
const projectRoot = path.resolve(__dirname, "..");
const dbUrl = `file:${path.resolve(projectRoot, "data", "dev.db")}`;

// Ensure data directory exists
fs.mkdirSync(path.dirname(path.resolve(projectRoot, "data", "dev.db")), { recursive: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: dbUrl,
  },
});
