-- AlterTable
ALTER TABLE "workflows" ADD COLUMN "current_seq" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "workflow_edit_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflow_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT,
    "ops_json" TEXT NOT NULL DEFAULT '[]',
    "inverse_ops_json" TEXT NOT NULL DEFAULT '[]',
    "snapshot_name" TEXT,
    "snapshot_definition" TEXT,
    "client_batch_id" TEXT,
    "target_seq" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workflow_edit_events_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "workflow_edit_events_workflow_id_seq_key" ON "workflow_edit_events"("workflow_id", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_edit_events_workflow_id_client_batch_id_key" ON "workflow_edit_events"("workflow_id", "client_batch_id");

-- CreateIndex
CREATE INDEX "workflow_edit_events_workflow_id_kind_seq_idx" ON "workflow_edit_events"("workflow_id", "kind", "seq");

-- CreateIndex
CREATE INDEX "workflow_edit_events_user_id_idx" ON "workflow_edit_events"("user_id");
