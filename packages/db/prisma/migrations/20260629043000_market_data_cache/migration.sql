CREATE TABLE "market_data_series" (
    "id" TEXT NOT NULL,
    "data_source_instance_id" TEXT NOT NULL,
    "provider_kind" TEXT NOT NULL,
    "identity_key" TEXT,
    "symbol" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_data_series_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "market_data_kline_bars" (
    "id" TEXT NOT NULL,
    "series_id" TEXT NOT NULL,
    "open_time" TIMESTAMP(3) NOT NULL,
    "close_time" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(65,30) NOT NULL,
    "high" DECIMAL(65,30) NOT NULL,
    "low" DECIMAL(65,30) NOT NULL,
    "close" DECIMAL(65,30) NOT NULL,
    "volume" DECIMAL(65,30),
    "is_final" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'provider',
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_data_kline_bars_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "market_data_sync_states" (
    "id" TEXT NOT NULL,
    "series_id" TEXT NOT NULL,
    "earliest_final_open_time" TIMESTAMP(3),
    "latest_final_open_time" TIMESTAMP(3),
    "latest_live_open_time" TIMESTAMP(3),
    "last_fetch_at" TIMESTAMP(3),
    "last_fetch_error" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_data_sync_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "market_data_series_data_source_instance_id_symbol_interval_key" ON "market_data_series"("data_source_instance_id", "symbol", "interval");
CREATE INDEX "market_data_series_provider_kind_identity_key_symbol_interval_idx" ON "market_data_series"("provider_kind", "identity_key", "symbol", "interval");
CREATE UNIQUE INDEX "market_data_kline_bars_series_id_open_time_key" ON "market_data_kline_bars"("series_id", "open_time");
CREATE INDEX "market_data_kline_bars_series_id_open_time_idx" ON "market_data_kline_bars"("series_id", "open_time");
CREATE INDEX "market_data_kline_bars_series_id_is_final_open_time_idx" ON "market_data_kline_bars"("series_id", "is_final", "open_time");
CREATE UNIQUE INDEX "market_data_sync_states_series_id_key" ON "market_data_sync_states"("series_id");

ALTER TABLE "market_data_series" ADD CONSTRAINT "market_data_series_data_source_instance_id_fkey" FOREIGN KEY ("data_source_instance_id") REFERENCES "data_source_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "market_data_kline_bars" ADD CONSTRAINT "market_data_kline_bars_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "market_data_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "market_data_sync_states" ADD CONSTRAINT "market_data_sync_states_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "market_data_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
