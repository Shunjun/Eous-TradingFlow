import { defineConfig } from "prisma/config";
import { resolveDbUrl } from "./src/resolve-db-url.js";

const dbUrl = resolveDbUrl(process.env.DATABASE_URL || "file:./data/dev.db");

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: dbUrl,
  },
});
