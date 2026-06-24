-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_agents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "provider_id" TEXT,
    "model_id" TEXT,
    "tool_scope" TEXT NOT NULL DEFAULT '[]',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "agents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_agents" (
    "id",
    "user_id",
    "name",
    "description",
    "instructions",
    "provider_id",
    "model_id",
    "created_at",
    "updated_at"
)
SELECT
    "id",
    "user_id",
    "name",
    "description",
    "system_prompt",
    "provider_id",
    "model_id",
    "created_at",
    "updated_at"
FROM "agents";

DROP TABLE "agents";
ALTER TABLE "new_agents" RENAME TO "agents";
CREATE INDEX "agents_user_id_idx" ON "agents"("user_id");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
