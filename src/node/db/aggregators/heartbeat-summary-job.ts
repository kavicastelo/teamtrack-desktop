import crypto from "crypto";
import {DatabaseService} from "../database.service";
import {RunResult} from "better-sqlite3";

export class HeartbeatSummaryJob {
    private timer?: NodeJS.Timeout;
    private running = false;
    private db;

    constructor(private dbs: DatabaseService, private intervalMs = 5 * 60 * 1000) {
        this.db = dbs.getDb();
    } // every 5 min

    start() {
        if (this.timer) return;
        this.timer = setInterval(() => this.run(), this.intervalMs);
        console.log('[HeartbeatSummaryJob] ⏰ Started');
    }

    stop() {
        if (this.timer) clearInterval(this.timer);
        this.timer = undefined;
    }

    async run() {
        if (this.running) return;
        this.running = true;
        try {
            const since = Date.now() - 48 * 60 * 60 * 1000; // 48h window incremental
            const rows: RunResult[] | any = this.dbs.query(`
        SELECT user_id, team_id,
               strftime('%Y-%m-%d', datetime(timestamp / 1000, 'unixepoch')) AS day,
               CAST(strftime('%H', datetime(timestamp / 1000, 'unixepoch')) AS INTEGER) AS hour,
               COALESCE(app, '(unknown)') AS app,
               COUNT(*) AS events,
               SUM(duration_ms)/60000.0 AS duration_minutes
        FROM heartbeats
        WHERE timestamp >= ?
        GROUP BY user_id, team_id, day, hour, app
      `, [since]);

            const stmt = this.db!.prepare(`
        INSERT INTO heartbeat_summaries (id, user_id, team_id, day, hour, events, duration_minutes, app, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, day, hour, app)
        DO UPDATE SET
          events = excluded.events,
          duration_minutes = excluded.duration_minutes,
          updated_at = excluded.updated_at;
      `);

            this.db.transaction(() => {
                for (const r of rows) {
                    stmt.run([
                        crypto.randomUUID(),
                        r.user_id,
                        r.team_id,
                        r.day,
                        r.hour,
                        r.events,
                        r.duration_minutes,
                        r.app,
                        Date.now(),
                    ]);
                }
            })();

            console.log(`[HeartbeatSummaryJob] ✅ Updated ${rows.length} summary rows`);
        } catch (err) {
            console.error('[HeartbeatSummaryJob] ❌ Failed', err);
        } finally {
            this.running = false;
        }
    }
}
