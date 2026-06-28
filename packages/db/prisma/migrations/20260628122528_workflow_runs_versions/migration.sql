-- AlterTable
ALTER TABLE "workflow_edit_events" ADD COLUMN     "target_definition" TEXT,
ADD COLUMN     "target_version_id" TEXT;

-- AlterTable
ALTER TABLE "workflow_versions" ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "workflows" ADD COLUMN     "active_version_id" TEXT,
ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "workflow_runs" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "workflow_version_id" TEXT,
    "user_id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'published',
    "status" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "report" TEXT,
    "error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_run_node_executions" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "node_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "inputs" TEXT NOT NULL,
    "outputs" TEXT,
    "logs" TEXT NOT NULL DEFAULT '[]',
    "error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "duration_ms" INTEGER,

    CONSTRAINT "workflow_run_node_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflow_runs_workflow_id_started_at_idx" ON "workflow_runs"("workflow_id", "started_at");

-- CreateIndex
CREATE INDEX "workflow_runs_workflow_version_id_idx" ON "workflow_runs"("workflow_version_id");

-- CreateIndex
CREATE INDEX "workflow_runs_user_id_idx" ON "workflow_runs"("user_id");

-- CreateIndex
CREATE INDEX "workflow_runs_status_idx" ON "workflow_runs"("status");

-- CreateIndex
CREATE INDEX "workflow_run_node_executions_run_id_idx" ON "workflow_run_node_executions"("run_id");

-- CreateIndex
CREATE INDEX "workflow_run_node_executions_workflow_id_node_id_idx" ON "workflow_run_node_executions"("workflow_id", "node_id");

-- CreateIndex
CREATE INDEX "workflow_run_node_executions_user_id_idx" ON "workflow_run_node_executions"("user_id");

-- CreateIndex
CREATE INDEX "workflows_enabled_idx" ON "workflows"("enabled");

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_active_version_id_fkey" FOREIGN KEY ("active_version_id") REFERENCES "workflow_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_version_id_fkey" FOREIGN KEY ("workflow_version_id") REFERENCES "workflow_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_run_node_executions" ADD CONSTRAINT "workflow_run_node_executions_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
