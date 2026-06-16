-- CreateTable
CREATE TABLE "chart_drawings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '[]',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "chart_drawings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chart_drawings_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "data_source_instances" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_chart_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'default',
    "auto_save_drawings" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "user_chart_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "chart_drawings_user_id_instance_id_symbol_key" ON "chart_drawings"("user_id", "instance_id", "symbol");

-- CreateIndex
CREATE INDEX "chart_drawings_instance_id_symbol_idx" ON "chart_drawings"("instance_id", "symbol");

-- CreateIndex
CREATE UNIQUE INDEX "user_chart_configs_user_id_scope_key" ON "user_chart_configs"("user_id", "scope");
