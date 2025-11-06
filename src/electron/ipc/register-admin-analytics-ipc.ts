import { ipcMain } from "electron";
import { DatabaseService } from "../../node/db/database.service";
import {RunResult} from "better-sqlite3";
import {HeartbeatSummaryJob} from "../../node/db/aggregators/heartbeat-summary-job";

export function registerAdminAnalyticsIPC(dbService: DatabaseService, hbJob: HeartbeatSummaryJob) {
    const CACHE_TTL = 60_000; // 1 minute cache
    const cache = new Map<string, { ts: number; data: any }>();

    const getCached = (key: string, fn: () => any) => {
        const entry = cache.get(key);
        if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
        const data = fn();
        cache.set(key, { ts: Date.now(), data });
        return data;
    };

    /**
     * Returns global organization metrics for dashboard
     */
    ipcMain.handle("analytics:getOrgSummary", async () => {
        const now = Date.now();

        const active24h = dbService.query(
            `SELECT COUNT(DISTINCT user_id) AS cnt FROM heartbeats WHERE last_seen > ?`,
            [now - 24 * 60 * 60 * 1000]
        )[0]?.cnt || 0;

        const active7d = dbService.query(
            `SELECT COUNT(DISTINCT user_id) AS cnt FROM heartbeats WHERE last_seen > ?`,
            [now - 7 * 24 * 60 * 60 * 1000]
        )[0]?.cnt || 0;

        const totalTasks = dbService.query(`SELECT COUNT(*) AS cnt FROM tasks`)[0]?.cnt || 0;
        const completedTasks = dbService.query(`SELECT COUNT(*) AS cnt FROM tasks WHERE status = 'done'`)[0]?.cnt || 0;
        const overdueTasks = dbService.query(
            `SELECT COUNT(*) AS cnt FROM tasks WHERE status != 'done' AND due_date IS NOT NULL AND due_date < ?`,
            [now]
        )[0]?.cnt || 0;

        const totalUsers = dbService.query(`SELECT COUNT(*) AS cnt FROM users`)[0]?.cnt || 0;

        return {
            active24h,
            active7d,
            totalTasks,
            completedTasks,
            overdueTasks,
            totalUsers,
        };
    });

    /**
     * Returns task throughput by day (last 30 days)
     */
    ipcMain.handle("analytics:getTaskThroughput", async () => {
        const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const rows = dbService.query(
            `SELECT date(strftime('%Y-%m-%d', datetime(updated_at / 1000, 'unixepoch'))) AS day,
              COUNT(*) AS completed
         FROM tasks
        WHERE status = 'done' AND updated_at > ?
        GROUP BY day
        ORDER BY day ASC`,
            [since]
        );
        return rows;
    });

    /**
     * Returns top 10 users by completed tasks in last 7 days
     */
    ipcMain.handle("analytics:getTopPerformers", async () => {
        const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const rows = dbService.query(
            `SELECT u.full_name, u.email, COUNT(t.id) AS completed
         FROM tasks t
         JOIN users u ON t.assignee = u.id
        WHERE t.status = 'done' AND t.updated_at > ?
        GROUP BY u.id, u.full_name, u.email
        ORDER BY completed DESC
        LIMIT 10`,
            [since]
        );
        return rows;
    });

    /**
     * Returns team utilization (time logged / capacity)
     */
    ipcMain.handle("analytics:getTeamUtilization", async () => {
        const now = Date.now();
        const since = now - 7 * 24 * 60 * 60 * 1000;

        const rows: RunResult[] | any = dbService.query(`
      SELECT tm.team_id,
             t.name AS team_name,
             SUM(te.duration_minutes) AS total_minutes,
             SUM(u.weekly_capacity_hours * 60) AS capacity_minutes
        FROM time_entries te
        JOIN users u ON te.user_id = u.id
        JOIN team_members tm ON tm.user_id = u.id
        JOIN teams t ON t.id = tm.team_id
       WHERE te.start_ts > ?
       GROUP BY tm.team_id
    `, [since]);

        // Compute utilization ratio in %
        return rows.map((r: any) => ({
            ...r,
            utilization_pct: r.capacity_minutes
                ? Math.round((r.total_minutes / r.capacity_minutes) * 100)
                : 0,
        }));
    });

    /**
     * Returns project workload (open, done, overdue)
     */
    ipcMain.handle("analytics:getProjectLoad", async () => {
        const now = Date.now();
        const rows = dbService.query(`
      SELECT p.id AS project_id, p.name AS project_name,
        SUM(CASE WHEN t.status != 'done' THEN 1 ELSE 0 END) AS open_count,
        SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS done_count,
        SUM(CASE WHEN t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date < ? THEN 1 ELSE 0 END) AS overdue_count
      FROM projects p
      LEFT JOIN tasks t ON t.project_id = p.id
      GROUP BY p.id, p.name
      ORDER BY overdue_count DESC
    `, [now]);

        return rows;
    });

    /**
     * Returns average activity minutes by hour (for heatmap)
     */
    ipcMain.handle("analytics:getFocusHeatmap", async () => {
        const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const rows = dbService.query(`
      SELECT strftime('%H', datetime(timestamp / 1000, 'unixepoch')) AS hour,
             COUNT(*) AS events
        FROM heartbeats
       WHERE timestamp > ?
       GROUP BY hour
       ORDER BY hour ASC
    `, [since]);
        return rows;
    });

    /**
     * analytics:getUserActivityHeatmap
     */
    ipcMain.handle(
        "analytics:getUserActivityHeatmap",
        async (_e, userId?: string, days = 7, perUserGrid = false) => {
            const now = Date.now();
            const since = now - days * 24 * 60 * 60 * 1000;
            const sinceISO = new Date(since).toISOString().slice(0, 10);
            const key = `heatmap:${userId || "all"}:${days}:${perUserGrid}`;

            return getCached(key, () => {
                let hourlySql = `
          SELECT hour, SUM(events) AS events
          FROM heartbeat_summaries
          WHERE day >= ?
        `;
                const params: any[] = [sinceISO];

                if (userId) {
                    hourlySql += ` AND user_id = ?`;
                    params.push(userId);
                }

                hourlySql += ` GROUP BY hour ORDER BY hour ASC;`;
                const hourlyRows: RunResult[] | any = dbService.query(hourlySql, params);

                // Build totalsByHour map (0..23)
                const totalsByHour: { [k: string]: number } = {};
                let max = 0;
                for (let h = 0; h < 24; h++) totalsByHour[String(h)] = 0;

                for (const r of hourlyRows) {
                    const h = String(parseInt(r.hour, 10));
                    totalsByHour[h] = (r.events as number) || 0;
                    if (totalsByHour[h] > max) max = totalsByHour[h];
                }

                // Optionally produce weekday x hour grid
                let weekdayHourGrid: { [weekday: string]: number[] } | undefined;
                if (perUserGrid || userId) {
                    const gridSql = `
            SELECT strftime('%w', day) AS weekday, hour, SUM(events) AS events
            FROM heartbeat_summaries
            WHERE day >= ?
            ${userId ? "AND user_id = ?" : ""}
            GROUP BY weekday, hour
            ORDER BY weekday ASC, hour ASC
          `;
                    const gridParams: any[] = [sinceISO];
                    if (userId) gridParams.push(userId);
                    const gridRows: RunResult[] | any = dbService.query(gridSql, gridParams);

                    weekdayHourGrid = {};
                    for (let d = 0; d < 7; d++) weekdayHourGrid[String(d)] = new Array(24).fill(0);

                    for (const r of gridRows) {
                        const wd = String(parseInt(r.weekday, 10)); // 0 (Sun) .. 6 (Sat)
                        const h = parseInt(r.hour, 10);
                        weekdayHourGrid[wd][h] = (r.events as number) || 0;
                        if (weekdayHourGrid[wd][h] > max) max = weekdayHourGrid[wd][h];
                    }
                }

                return {
                    since,
                    totalsByHour,
                    weekdayHourGrid,
                    max,
                };
            });
        }
    );

    /**
     * analytics:getAppUsage
     */
    ipcMain.handle(
        "analytics:getAppUsage",
        async (_e, days = 7, limit = 10, userId?: string) => {
            const since = Date.now() - (days || 7) * 24 * 60 * 60 * 1000;
            const sinceISO = new Date(since).toISOString().slice(0, 10);
            const key = `appUsage:${userId || "all"}:${days}:${limit}`;

            return getCached(key, () => {
                let sql = `
          SELECT COALESCE(app, '(unknown)') AS app,
                 SUM(duration_minutes) AS minutes,
                 SUM(events) AS events
          FROM heartbeat_summaries
          WHERE day >= ?
        `;
                const params: any[] = [sinceISO];
                if (userId) {
                    sql += ` AND user_id = ?`;
                    params.push(userId);
                }

                sql += `
          GROUP BY app
          ORDER BY minutes DESC
          LIMIT ?
        `;
                params.push(limit);

                const rows: RunResult[] | any = dbService.query(sql, params);

                return rows.map((r: any) => ({
                    app: r.app,
                    minutes: Math.round((r.minutes || 0) * 100) / 100,
                    events: r.events || 0,
                }));
            });
        }
    );

    /**
     * analytics:forceRefreshSummaries
     */
    ipcMain.handle("analytics:forceRefreshSummaries", async () => {
        await hbJob.run();
        cache.clear();
        return { ok: true };
    });
}
