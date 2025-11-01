import { ipcMain } from "electron";
import { DatabaseService } from "../../node/db/database.service";

export function registerMetricsIPC(dbService: DatabaseService) {

    ipcMain.handle('metrics:getMyWork', async (_e, userId: string) => {
        const now = Date.now();
        const todayEnd = now + 24 * 60 * 60 * 1000;
        const weekEnd = now + 7 * 24 * 60 * 60 * 1000;

        const dueToday = dbService.query(`
      SELECT * FROM tasks
      WHERE assignee = ?
        AND due_date IS NOT NULL
        AND due_date <= ?
      ORDER BY due_date ASC
      LIMIT 50
    `, [userId, todayEnd]);

        const dueWeekCount = dbService.query(`
      SELECT COUNT(*) AS cnt FROM tasks
      WHERE assignee = ?
        AND due_date IS NOT NULL
        AND due_date <= ?
    `, [userId, weekEnd])[0].cnt;

        const overdueCount = dbService.query(`
      SELECT COUNT(*) AS cnt FROM tasks
      WHERE assignee = ?
        AND due_date IS NOT NULL
        AND due_date < ?
        AND status != 'done'
    `, [userId, now])[0].cnt;

        let timeTrackedMin = 0;
        try {
            const row = dbService.query(`
        SELECT COALESCE(SUM(duration_minutes),0) AS mins
        FROM time_entries
        WHERE user_id = ?
          AND start_ts >= ?
      `, [userId, now - 7 * 24 * 60 * 60 * 1000])[0];

            timeTrackedMin = row?.mins || 0;
        } catch {}

        return { dueToday, dueWeekCount, overdueCount, timeTrackedMin };
    });


    ipcMain.handle('metrics:getTeamPulse', async (_e, teamId: string) => {

        const online = dbService.query(`
      SELECT user_id, last_seen
      FROM heartbeats
      WHERE team_id = ?
        AND last_seen > ?
      ORDER BY last_seen DESC
    `, [teamId, Date.now() - 5 * 60 * 1000]);

        const throughput = dbService.query(`
      SELECT date(strftime('%Y-%m-%d', datetime(updated_at / 1000, 'unixepoch'))) AS day,
             COUNT(*) AS completed
      FROM tasks
      WHERE status = 'done'
        AND project_id IN (SELECT id FROM projects WHERE team_id = ?)
        AND updated_at > ?
      GROUP BY day
      ORDER BY day ASC
    `, [teamId, Date.now() - 14 * 24 * 60 * 60 * 1000]);

        return { online, throughput };
    });


    ipcMain.handle('metrics:getActivityTimeline', async (_e, limit = 100) => {
        const events = dbService.query(`
      SELECT 'event' as kind, id, actor, action, object_type, object_id, payload, created_at as ts
      FROM events
    `) as any[];

        const revisions = dbService.query(`
      SELECT 'revision' as kind, id, origin_id as actor, NULL as action, object_type, object_id, payload, created_at as ts
      FROM revisions
    `) as any[];

        const attachments = dbService.query(`
      SELECT 'attachment' as kind, id, uploaded_by as actor,
             'upload' as action, 'attachment' as object_type,
             taskId as object_id, filename as payload, created_at as ts
      FROM attachments
    `) as any[];

        const merged = [...events, ...revisions, ...attachments]
            .sort((a, b) => b.ts - a.ts)
            .slice(0, limit);

        return merged;
    });

    ipcMain.handle('metrics:getActivityByUser', async (_e, userId: string, limit = 100) => {
        const events = dbService.query(`
      SELECT 'event' as kind, id, actor, action, object_type, object_id, payload, created_at as ts
      FROM events
      WHERE actor = ?
    `, [userId]) as any[];

        const revisions = dbService.query(`
      SELECT 'revision' as kind, id, origin_id as actor, NULL as action, object_type, object_id, payload, created_at as ts
      FROM revisions
      WHERE origin_id = ?
    `, [userId]) as any[];

        const attachments = dbService.query(`
      SELECT 'attachment' as kind, id, uploaded_by as actor,
             'upload' as action, 'attachment' as object_type,
             taskId as object_id, filename as payload, created_at as ts
      FROM attachments
      WHERE uploaded_by = ?
    `, [userId]) as any[];

        const merged = [...events, ...revisions, ...attachments]
            .sort((a, b) => b.ts - a.ts)
            .slice(0, limit);

        return merged;
    });

    ipcMain.handle('metrics:getProjectHeatmap', async (_e, timeframeDays = 30) => {
        const since = Date.now() - timeframeDays * 24 * 60 * 60 * 1000;

        const rows = dbService.query(`
      SELECT p.id AS project_id, p.name AS project_name,
        SUM(CASE WHEN t.status != 'done' THEN 1 ELSE 0 END) AS open_count,
        SUM(CASE WHEN t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date < ? THEN 1 ELSE 0 END) AS overdue_count
      FROM projects p
      LEFT JOIN tasks t ON t.project_id = p.id
      GROUP BY p.id, p.name
      ORDER BY open_count DESC
      LIMIT 100
    `, [Date.now()]);

        return rows;
    });
}
