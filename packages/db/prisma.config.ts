import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
