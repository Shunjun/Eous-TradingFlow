ALTER TABLE "agent_messages" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'text';
ALTER TABLE "agent_messages" ADD COLUMN "resource_id" TEXT;
CREATE INDEX "agent_messages_resource_id_idx" ON "agent_messages"("resource_id");
