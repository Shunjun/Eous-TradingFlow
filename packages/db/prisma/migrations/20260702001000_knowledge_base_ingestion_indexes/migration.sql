ALTER TABLE "knowledge_bases" ADD COLUMN "active_index_id" TEXT;

ALTER TABLE "knowledge_documents" ADD COLUMN "source_file_name" TEXT;
ALTER TABLE "knowledge_documents" ADD COLUMN "source_mime_type" TEXT;
ALTER TABLE "knowledge_documents" ADD COLUMN "source_size" INTEGER;
ALTER TABLE "knowledge_documents" ADD COLUMN "source_hash" TEXT;
ALTER TABLE "knowledge_documents" ADD COLUMN "strategy" TEXT NOT NULL DEFAULT 'raw';
ALTER TABLE "knowledge_documents" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'uploaded';
ALTER TABLE "knowledge_documents" ALTER COLUMN "content" SET DEFAULT '';

CREATE TABLE "knowledge_ingestion_runs" (
    "id" TEXT NOT NULL,
    "knowledge_base_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "strategy" TEXT NOT NULL DEFAULT 'raw',
    "parse_config" TEXT NOT NULL DEFAULT '{}',
    "chunk_config" TEXT NOT NULL DEFAULT '{}',
    "compression_config" TEXT NOT NULL DEFAULT '{}',
    "embedding_config" TEXT NOT NULL DEFAULT '{}',
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_ingestion_runs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "knowledge_chunks" ADD COLUMN "run_id" TEXT;
ALTER TABLE "knowledge_chunks" ADD COLUMN "source_raw_chunk_id" TEXT;
ALTER TABLE "knowledge_chunks" ADD COLUMN "compressed_chunk_id" TEXT;
ALTER TABLE "knowledge_chunks" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'raw';
ALTER TABLE "knowledge_chunks" ADD COLUMN "embedding_role" TEXT NOT NULL DEFAULT 'indexed';
ALTER TABLE "knowledge_chunks" ADD COLUMN "token_count" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "knowledge_embedding_indexes" (
    "id" TEXT NOT NULL,
    "knowledge_base_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "dimension" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'building',
    "chunk_config_hash" TEXT,
    "strategy" TEXT NOT NULL DEFAULT 'raw',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_embedding_indexes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "knowledge_embeddings" (
    "id" TEXT NOT NULL,
    "index_id" TEXT NOT NULL,
    "chunk_id" TEXT NOT NULL,
    "vector" vector NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_embeddings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "knowledge_documents_status_idx" ON "knowledge_documents"("status");
CREATE INDEX "knowledge_documents_strategy_idx" ON "knowledge_documents"("strategy");

CREATE INDEX "knowledge_ingestion_runs_knowledge_base_id_idx" ON "knowledge_ingestion_runs"("knowledge_base_id");
CREATE INDEX "knowledge_ingestion_runs_document_id_idx" ON "knowledge_ingestion_runs"("document_id");
CREATE INDEX "knowledge_ingestion_runs_status_idx" ON "knowledge_ingestion_runs"("status");

CREATE INDEX "knowledge_chunks_run_id_idx" ON "knowledge_chunks"("run_id");
CREATE INDEX "knowledge_chunks_kind_idx" ON "knowledge_chunks"("kind");
CREATE INDEX "knowledge_chunks_embedding_role_idx" ON "knowledge_chunks"("embedding_role");
CREATE INDEX "knowledge_chunks_source_raw_chunk_id_idx" ON "knowledge_chunks"("source_raw_chunk_id");

CREATE INDEX "knowledge_embedding_indexes_knowledge_base_id_idx" ON "knowledge_embedding_indexes"("knowledge_base_id");
CREATE INDEX "knowledge_embedding_indexes_status_idx" ON "knowledge_embedding_indexes"("status");
CREATE INDEX "knowledge_embedding_indexes_provider_id_model_id_idx" ON "knowledge_embedding_indexes"("provider_id", "model_id");

CREATE UNIQUE INDEX "knowledge_embeddings_index_id_chunk_id_key" ON "knowledge_embeddings"("index_id", "chunk_id");
CREATE INDEX "knowledge_embeddings_index_id_idx" ON "knowledge_embeddings"("index_id");
CREATE INDEX "knowledge_embeddings_chunk_id_idx" ON "knowledge_embeddings"("chunk_id");

ALTER TABLE "knowledge_ingestion_runs" ADD CONSTRAINT "knowledge_ingestion_runs_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_ingestion_runs" ADD CONSTRAINT "knowledge_ingestion_runs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "knowledge_ingestion_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "knowledge_embedding_indexes" ADD CONSTRAINT "knowledge_embedding_indexes_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_embeddings" ADD CONSTRAINT "knowledge_embeddings_index_id_fkey" FOREIGN KEY ("index_id") REFERENCES "knowledge_embedding_indexes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_embeddings" ADD CONSTRAINT "knowledge_embeddings_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "knowledge_chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
