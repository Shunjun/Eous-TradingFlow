CREATE TABLE "user_model_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "chat_provider_id" TEXT,
    "chat_model_id" TEXT,
    "compression_provider_id" TEXT,
    "compression_model_id" TEXT,
    "embedding_provider_id" TEXT,
    "embedding_model_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_model_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_model_settings_user_id_key" ON "user_model_settings"("user_id");

ALTER TABLE "user_model_settings" ADD CONSTRAINT "user_model_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
