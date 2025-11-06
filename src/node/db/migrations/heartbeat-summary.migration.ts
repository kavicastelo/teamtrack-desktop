export async function ensureHeartbeatSummarySchema(db: any) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS heartbeat_summaries (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      team_id TEXT,
      day TEXT,
      hour INTEGER,
      events INTEGER DEFAULT 0,
      duration_minutes REAL DEFAULT 0,
      app TEXT,
      updated_at INTEGER
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_hb_summary_unique
      ON heartbeat_summaries(user_id, day, hour, app);

    CREATE INDEX IF NOT EXISTS idx_hb_summary_user_day
      ON heartbeat_summaries(user_id, day);

    CREATE INDEX IF NOT EXISTS idx_hb_summary_team_day
      ON heartbeat_summaries(team_id, day);

    CREATE INDEX IF NOT EXISTS idx_hb_summary_app
      ON heartbeat_summaries(app);

    CREATE INDEX IF NOT EXISTS idx_heartbeats_ts_user
      ON heartbeats(user_id, timestamp);

    CREATE INDEX IF NOT EXISTS idx_heartbeats_app
      ON heartbeats(app);

    CREATE INDEX IF NOT EXISTS idx_heartbeats_team
      ON heartbeats(team_id);
  `);

    console.log('[Migration] ✅ Heartbeat summaries and indexes ensured');
}
