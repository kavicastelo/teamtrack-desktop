CREATE TABLE IF NOT EXISTS projects (
                          id TEXT PRIMARY KEY,
                          name TEXT NOT NULL,
                          description TEXT,
                          owner_id TEXT,
                          created_at INTEGER,
                          updated_at INTEGER,
                          team_id TEXT
);

CREATE TABLE IF NOT EXISTS teams (
                       id TEXT PRIMARY KEY,
                       project_id TEXT,
                       name TEXT NOT NULL,
                       description TEXT,
                       created_at INTEGER,
                       updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS team_members (
                              id TEXT PRIMARY KEY,
                              team_id TEXT,
                              user_id TEXT,
                              role TEXT,
                              created_at INTEGER
);

CREATE TABLE IF NOT EXISTS users (
                       id TEXT PRIMARY KEY,
                       email TEXT,
                       full_name TEXT,
                       role TEXT,
                       avatar_url TEXT,
                       default_team_id TEXT,
                       timezone TEXT,
                       calendar_sync_enabled INTEGER DEFAULT 0,
                       google_calendar_id TEXT,
                       available_times TEXT,
                       updated_at INTEGER,
                       invited_at INTEGER,
                       google_refresh_token TEXT,
                       last_calendar_sync INTEGER,
                       weekly_capacity_hours INTEGER
);

CREATE TABLE IF NOT EXISTS local_session (
                               id TEXT PRIMARY KEY,
                               session_encrypted TEXT
);

CREATE TABLE IF NOT EXISTS calendar_tokens (
                                 user_id TEXT PRIMARY KEY,
                                 session_encrypted TEXT NOT NULL,
                                 updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
                       id TEXT PRIMARY KEY,
                       project_id TEXT,
                       title TEXT,
                       description TEXT,
                       status TEXT,
                       assignee TEXT,
                       updated_at INTEGER,
                       created_at INTEGER,
                       due_date INTEGER,
                       priority INTEGER
);

CREATE TABLE IF NOT EXISTS events (
                        id TEXT PRIMARY KEY,
                        actor TEXT,
                        action TEXT,
                        object_type TEXT,
                        object_id TEXT,
                        payload TEXT,
                        created_at INTEGER
);

CREATE TABLE IF NOT EXISTS calendar_events (
                                 id TEXT PRIMARY KEY,
                                 user_id TEXT,
                                 calendar_id TEXT,
                                 start INTEGER,
                                 end INTEGER,
                                 summary TEXT,
                                 updated_at INTEGER,
                                 raw TEXT
);

CREATE TABLE IF NOT EXISTS revisions (
                           id TEXT PRIMARY KEY,
                           object_type TEXT,
                           object_id TEXT,
                           origin_id TEXT,
                           seq INTEGER,
                           payload TEXT,
                           created_at INTEGER,
                           synced INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS attachments (
                             id TEXT PRIMARY KEY,
                             uploaded_by TEXT,
                             taskId TEXT,
                             filename TEXT,
                             mimetype TEXT,
                             size INTEGER,
                             supabase_path TEXT,
                             created_at INTEGER
);

CREATE TABLE IF NOT EXISTS heartbeats (
                            id TEXT PRIMARY KEY,
                            user_id TEXT,
                            timestamp INTEGER NOT NULL,
                            duration_ms INTEGER,
                            source TEXT,
                            platform TEXT,
                            app TEXT,
                            title TEXT,
                            metadata TEXT,
                            team_id TEXT,
                            last_seen INTEGER
);

CREATE INDEX IF NOT EXISTS idx_heartbeats_timestamp ON heartbeats(timestamp);
CREATE INDEX IF NOT EXISTS idx_heartbeats_user ON heartbeats(user_id);
CREATE INDEX IF NOT EXISTS idx_heartbeats_team ON heartbeats(team_id);
CREATE INDEX IF NOT EXISTS idx_heartbeats_user_ts ON heartbeats(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_heartbeats_app_ts ON heartbeats(app, timestamp);

CREATE TABLE IF NOT EXISTS time_entries (
                              id TEXT PRIMARY KEY,
                              user_id TEXT,
                              project_id TEXT,
                              task_id TEXT,
                              start_ts INTEGER,
                              duration_minutes INTEGER,
                              created_at INTEGER
);

CREATE TABLE IF NOT EXISTS notifications (
                               id TEXT PRIMARY KEY,
                               user_id TEXT NOT NULL,
                               type TEXT NOT NULL,
                               title TEXT NOT NULL,
                               message TEXT NOT NULL,
                               data TEXT,
                               read INTEGER NOT NULL DEFAULT 0,
                               created_at INTEGER NOT NULL,
                               updated_at INTEGER NOT NULL
);
