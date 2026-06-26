CREATE TABLE "agent_observational_memories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "thread_id" TEXT,
    "resource_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "origin_type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "agent_observational_memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "agent_observational_memories_resource_id_scope_created_at_idx" ON "agent_observational_memories"("resource_id", "scope", "created_at");
CREATE INDEX "agent_observational_memories_thread_id_idx" ON "agent_observational_memories"("thread_id");
CREATE INDEX "agent_observational_memories_user_id_idx" ON "agent_observational_memories"("user_id");
