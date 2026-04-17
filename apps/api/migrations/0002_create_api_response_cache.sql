CREATE TABLE IF NOT EXISTS api_response_cache (
  cache_key TEXT PRIMARY KEY,
  fetched_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_api_response_cache_fetched_at
  ON api_response_cache (fetched_at DESC);
