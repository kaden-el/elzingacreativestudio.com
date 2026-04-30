-- ── ANALYTICS TABLE ──────────────────────────────────────────────
-- Stores fetched analytics data per client per platform per date range
-- Updated every time the refresh button is clicked

CREATE TABLE IF NOT EXISTS analytics (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id    text NOT NULL,
  platform     text NOT NULL,       -- 'meta' or 'google'
  date_preset  text NOT NULL,       -- 'last_7d', 'last_30d', 'last_90d'
  data         jsonb DEFAULT '{}',  -- full parsed response
  updated_at   timestamptz DEFAULT now(),
  UNIQUE(client_id, platform, date_preset)
);

ALTER TABLE analytics DISABLE ROW LEVEL SECURITY;

-- Index for fast lookups by client
CREATE INDEX IF NOT EXISTS analytics_client_id_idx ON analytics(client_id);
