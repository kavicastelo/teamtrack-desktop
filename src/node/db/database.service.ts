import Database from "better-sqlite3";
import {drizzle} from "drizzle-orm/better-sqlite3";
import fs from "fs";
import crypto from "crypto";
import os from "os";
import path from "path";
import {v4 as uuidv4} from "uuid";

const ALGO = "aes-256-gcm";

function decryptBuffer(encrypted: Buffer, key: Buffer): Buffer {
  const iv = encrypted.subarray(0, 12);
  const tag = encrypted.subarray(12, 28);
  const ciphertext = encrypted.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function encryptBuffer(plain: Buffer, key: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]);
}

export class DatabaseService {
  private readonly encryptedPath: string;
  private readonly key: Buffer;
  private tmpPath!: string;
  private db?: Database.Database;
  private orm?: ReturnType<typeof drizzle>;

  constructor(opts: { dbPath: string; encryptionKey: string }) {
    this.encryptedPath = opts.dbPath;
    this.key = crypto.createHash("sha256").update(opts.encryptionKey).digest();
  }

  async open() {
    this.tmpPath = path.join(os.tmpdir(), `teamtrack-${uuidv4()}.db`);

    if (fs.existsSync(this.encryptedPath)) {
      try {
        const encrypted = fs.readFileSync(this.encryptedPath);
        const plain = decryptBuffer(encrypted, this.key);
        fs.writeFileSync(this.tmpPath, plain, { mode: 0o600 });
        console.log("[DB] Decrypted existing DB");
      } catch (err) {
        console.warn("[DB] Failed to decrypt — creating new DB:", err);
      }
    } else {
      console.log("[DB] No existing DB found — creating new");
    }

    this.db = new Database(this.tmpPath, { verbose: (message: unknown, ...additionalArgs: unknown[]) => {
        // console.log("[DB]", message, ...additionalArgs);
      } });
    this.orm = drizzle(this.db);
    await this.ensureSchema();
  }

  private async ensureSchema() {
    this.db!.exec(`
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

      CREATE TABLE IF NOT EXISTS time_entries (
                                                id TEXT PRIMARY KEY,
                                                user_id TEXT,
                                                project_id TEXT,
                                                task_id TEXT,
                                                start_ts INTEGER,
                                                duration_minutes INTEGER,
                                                created_at INTEGER
      );
    `);
  }

  getOrm() {
    if (!this.orm) throw new Error("DB not initialized");
    return this.orm;
  }

  async close() {
    if (!this.db) return;
    const tmp = (this.db as any).name;
    this.db.close();

    const plain = fs.readFileSync(tmp);
    const encrypted = encryptBuffer(plain, this.key);
    fs.writeFileSync(this.encryptedPath, encrypted, { mode: 0o600 });
    fs.unlinkSync(tmp);
    console.log("[DB] Closed + Encrypted at", this.encryptedPath);
  }

  query(sql: string, params?: any[]) {
    if (!this.db) throw new Error("DB not open");
    const stmt = this.db.prepare(sql);
    const bind = Array.isArray(params)
        ? params
        : params !== undefined
            ? [params]
            : [];
    if (/^\s*select/i.test(sql)) return stmt.all(...bind);
    return stmt.run(...bind);
  }

  createTask(payload: any) {
    const id = payload.id || uuidv4();
    payload.id = id;
    const now = Date.now();
    payload.updated_at = now;
    payload.created_at = now;
    this.db!.prepare(
        `INSERT INTO tasks (id, project_id, title, description, status, assignee, updated_at, created_at, due_date, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        id,
        payload.project_id || null,
        payload.title,
        payload.description || "",
        payload.status || "todo",
        payload.assignee || null,
        now,
        now,
        payload.due_date || null,
        payload.priority || 1
    );

    // Add revision entry for sync
    this.db!.prepare(
        `INSERT INTO revisions (id, object_type, object_id, seq, payload, created_at, synced)
       VALUES (?, ?, ?, ?, ?, ?, 0)`
    ).run(uuidv4(), "tasks", id, 1, JSON.stringify(payload), now);

    return { id, ...payload, updated_at: now };
  }

  listTasks(projectId?: string) {
    if (projectId)
      return this.db!.prepare(`SELECT * FROM tasks WHERE project_id=? ORDER BY updated_at DESC`).all(projectId);
    return this.db!.prepare(`SELECT * FROM tasks ORDER BY updated_at DESC`).all();
  }

  updateTask(payload: any) {
    if (!payload.id) throw new Error("Missing task ID");

    const existing: any = this.getTaskById(payload.id);
    if (!existing) throw new Error("Task not found");

    const now = Date.now();
    const previousStatus = existing.status;
    const newStatus = payload.status || existing.status;

    payload.updated_at = now;

    // --- TIME ENTRY HANDLING ---
    // Start tracking when entering inprogress
    if (previousStatus !== 'in-progress' && newStatus === 'in-progress') {
      const timeEntryId = crypto.randomUUID();
      const timePayload = {
        id: timeEntryId,
        user_id: payload.assignee || existing.assignee || null,
        project_id: payload.project_id || existing.project_id || null,
        task_id: payload.id,
        start_ts: now,
        duration_minutes: 0,
        created_at: now,
      };

      this.db!.prepare(`
      INSERT INTO time_entries (id, user_id, project_id, task_id, start_ts, duration_minutes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
          timeEntryId,
          timePayload.user_id,
          timePayload.project_id,
          timePayload.task_id,
          timePayload.start_ts,
          timePayload.duration_minutes,
          timePayload.created_at
      );

      // Add revision for syncing
      this.db!.prepare(`
      INSERT INTO revisions (id, object_type, object_id, seq, payload, created_at, synced)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).run(
          crypto.randomUUID(),
          "time_entries",
          timeEntryId,
          now,
          JSON.stringify(timePayload),
          now
      );
    }

    // Stop tracking when leaving in-progress
    if (previousStatus === 'in-progress' && newStatus !== 'in-progress') {
      const openEntry: any = this.db!.prepare(`
      SELECT * FROM time_entries
      WHERE task_id = ? AND duration_minutes = 0
      ORDER BY start_ts DESC LIMIT 1
    `).get(payload.id);

      if (openEntry) {
        const durationMinutes = Math.max(1, Math.round((now - openEntry.start_ts) / 60000));

        this.db!.prepare(`
        UPDATE time_entries SET duration_minutes = ? WHERE id = ?
      `).run(durationMinutes, openEntry.id);

        // Push update to revisions
        const updatedEntry = { ...openEntry, duration_minutes: durationMinutes };
        this.db!.prepare(`
        INSERT INTO revisions (id, object_type, object_id, seq, payload, created_at, synced)
        VALUES (?, ?, ?, ?, ?, ?, 0)
      `).run(
            crypto.randomUUID(),
            "time_entries",
            openEntry.id,
            now,
            JSON.stringify(updatedEntry),
            now
        );
      }
    }

    // --- TASK UPDATE LOGIC ---
    const stmt = this.db!.prepare(`
    UPDATE tasks
    SET project_id = ?, title = ?, description = ?, status = ?, assignee = ?, updated_at = ?, created_at = ?, due_date = ?, priority = ?
    WHERE id = ?
  `);

    stmt.run(
        payload.project_id || existing.project_id || null,
        payload.title || existing.title,
        payload.description || existing.description,
        newStatus,
        payload.assignee || existing.assignee || null,
        now,
        payload.created_at || existing.created_at,
        payload.due_date || existing.due_date,
        payload.priority || existing.priority,
        payload.id
    );

    // --- TASK REVISION ENTRY ---
    this.db!.prepare(`
    INSERT INTO revisions (id, object_type, object_id, seq, payload, created_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `).run(
        crypto.randomUUID(),
        "tasks",
        payload.id,
        now,
        JSON.stringify(payload),
        now
    );

    return { ...payload, updated_at: now };
  }

  getTaskById(id: string) {
    return this.db!.prepare(`SELECT * FROM tasks WHERE id=?`).get(id);
  }

  deleteTask(taskId: string) {
    try {
      this.db!.prepare(`DELETE FROM revisions WHERE object_id = ?`).run(taskId);
      this.db!.prepare(`DELETE FROM tasks WHERE id = ?`).run(taskId);
      return true;
    } catch (err: any) {
      console.error("[DB] deleteTask error:", err);
      return false;
    }
  }

  async logEvent(e: any) {
    const id = uuidv4();
    const now = Date.now();
    e.created_at = now;
    this.db!.prepare(
        `INSERT INTO events (id, actor, action, object_type, object_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
        id,
        e.actor || null,
        e.action,
        e.object_type || null,
        e.object_id || null,
        JSON.stringify(e.payload || {}),
        now
    );

    // Add revision entry for sync
    this.db!.prepare(
        `INSERT INTO revisions (id, object_type, object_id, seq, payload, created_at, synced)
       VALUES (?, ?, ?, ?, ?, ?, 0)`
    ).run(uuidv4(), "events", id, 1, JSON.stringify(e), now);
  }

  // PROJECTS
  createProject(payload: any) {
    const id = payload.id || uuidv4();
    payload.id = id;
    const now = Date.now();
    payload.updated_at = now;
    payload.created_at = now;
    this.db!.prepare(`
    INSERT INTO projects (id, name, description, owner_id, created_at, updated_at, team_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, payload.name, payload.description || '', payload.owner_id || null, now, now, payload.team_id || null);

    this.db!.prepare(`
    INSERT INTO revisions (id, object_type, object_id, seq, payload, created_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `).run(uuidv4(), 'projects', id, 1, JSON.stringify(payload), now);

    return { id, ...payload, created_at: now, updated_at: now };
  }

  listProjects(projectId?: string) {
    if (projectId)
      return this.db!.prepare(`SELECT * FROM projects WHERE id=? ORDER BY updated_at DESC`).all(projectId);
    return this.db!.prepare(`SELECT * FROM projects ORDER BY updated_at DESC`).all();
  }

  updateProject(payload: any) {
    if (!payload.id) throw new Error("Missing project ID");
    const now = Date.now();
    this.db!.prepare(`
    UPDATE projects SET name=?, description=?, team_id, updated_at=? WHERE id=?
  `).run(payload.name, payload.description || '', payload.team_id || null, now, payload.id);

    this.db!.prepare(`
    INSERT INTO revisions (id, object_type, object_id, seq, payload, created_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `).run(crypto.randomUUID(), 'projects', payload.id, Date.now(), JSON.stringify(payload), now);

    return { ...payload, updated_at: now };
  }

// TEAMS
  createTeam(payload: any) {
    const id = payload.id || uuidv4();
    payload.id = id;
    const now = Date.now();
    payload.updated_at = now;
    payload.created_at = now;
    this.db!.prepare(`
    INSERT INTO teams (id, project_id, name, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, payload.project_id, payload.name, payload.description || '', now, now);

    this.db!.prepare(`
    INSERT INTO revisions (id, object_type, object_id, seq, payload, created_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `).run(uuidv4(), 'teams', id, 1, JSON.stringify(payload), now);

    return { id, ...payload, created_at: now, updated_at: now };
  }

  listTeams(projectId?: string) {
    if (projectId)
      return this.db!.prepare(`SELECT * FROM teams WHERE project_id=? ORDER BY updated_at DESC`).all(projectId);
    return this.db!.prepare(`SELECT * FROM teams ORDER BY updated_at DESC`).all();
  }

  updateTeam(payload: any) {
    if (!payload.id) throw new Error("Missing team ID");
    const now = Date.now();
    this.db!.prepare(`
    UPDATE teams SET name=?, description=?, updated_at=? WHERE id=?
  `).run(payload.name, payload.description || '', now, payload.id);

    this.db!.prepare(`
    INSERT INTO revisions (id, object_type, object_id, seq, payload, created_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `).run(crypto.randomUUID(), 'teams', payload.id, Date.now(), JSON.stringify(payload), now);

    return { ...payload, updated_at: now };
  }

// USERS
  public createUser(payload: any) {
    const id = payload.id || uuidv4();
    payload.id = id;
    const now = Date.now();
    payload.updated_at = now;
    payload.invited_at = now;
    this.db!.prepare(`
    INSERT INTO users (id, email, full_name, role, avatar_url, timezone, calendar_sync_enabled, google_calendar_id, available_times, updated_at, invited_at, google_refresh_token, last_calendar_sync, weekly_capacity_hours)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, payload.email, '', payload.role, '', '', 0, '', '', now, now, '', null, 0);

    this.db!.prepare(`
    INSERT INTO revisions (id, object_type, object_id, seq, payload, created_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `).run(uuidv4(), 'users', id, 1, JSON.stringify(payload), now);

    return { id, ...payload, updated_at: now, invited_at: now };
  }

  public createTeamMember(payload: any) {
    const id = payload.id || uuidv4();
    payload.id = id;
    const now = Date.now();
    payload.created_at = now;
    this.db!.prepare(`
    INSERT INTO team_members (id, team_id, user_id, role, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, payload.team_id, payload.user_id, payload.role, now);

    this.db!.prepare(`
    INSERT INTO revisions (id, object_type, object_id, seq, payload, created_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `).run(uuidv4(), 'team_members', id, 1, JSON.stringify(payload), now);

    return { id, ...payload, created_at: now };
  }

  public updateUserRole(payload: any) {
    const now = Date.now();
    this.db!.prepare(`
      UPDATE users SET role=? WHERE id=?
    `).run(payload.role, payload.userId);
    return { ...payload, updated_at: now };
  }

  public updateTeamMemberRole(payload: any) {
    const now = Date.now();
    this.db!.prepare(`
      UPDATE team_members SET role=? WHERE team_id=? AND user_id=?
    `).run(payload.role, payload.team_id, payload.user_id);
    return { ...payload, updated_at: now };
  }

  public updateUserProfile(payload: any) {
    const now = Date.now();
    this.db!.prepare(`
      UPDATE users SET full_name=?, avatar_url=?, timezone=?, weekly_capacity_hours=?, google_calendar_id=?, calendar_sync_enabled=?, available_times=? WHERE id=?
    `).run(payload.full_name, payload.avatar_url, payload.timezone, payload.weekly_capacity_hours, payload.google_calendar_id, payload.calendar_sync_enabled, payload.available_times, payload.id);
    return { ...payload, updated_at: now };
  }

// HEARTBEATS
  createHeartbeat(payload: any) {
    const id = payload.id || uuidv4();
    const now = Date.now();
    payload.id = id;
    payload.created_at = now;
    payload.synced = 0;

    this.db!.prepare(`
    INSERT INTO heartbeats (
      id, user_id, timestamp, duration_ms, source, platform, app, title, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
        id,
        payload.user_id,
        payload.timestamp,
        payload.duration_ms,
        payload.source,
        payload.platform,
        payload.app,
        payload.title,
        payload.metadata
    );

    this.db!.prepare(`
    INSERT INTO revisions (id, object_type, object_id, seq, payload, created_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `).run(uuidv4(), 'heartbeats', id, 1, JSON.stringify(payload), now);

    return payload;
  }

// CALENDARS
  public updateUserCalendarSync(payload: any) {
    const now = Date.now();
    this.db!.prepare(`
      UPDATE users SET
                     google_refresh_token = ?,
                     google_calendar_id = ?,
                     calendar_sync_enabled = ?,
                     last_calendar_sync = ?
      WHERE id = ?
    `).run(payload.google_refresh_token, payload.google_calendar_id, payload.calendar_sync_enabled, payload.last_calendar_sync, payload.id);
    return { ...payload, updated_at: now };
  }

  async upsertEventLocal(ev: any, ownerUserId: string) {
    const stmt = this.db.prepare(`
    INSERT INTO calendar_events (id, user_id, calendar_id, start, end, summary, updated_at, raw)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      user_id = excluded.user_id,
      calendar_id = excluded.calendar_id,
      start = excluded.start,
      end = excluded.end,
      summary = excluded.summary,
      updated_at = excluded.updated_at,
      raw = excluded.raw
  `);

    const start = new Date(ev.start.dateTime || ev.start.date).getTime();
    const end = new Date(ev.end.dateTime || ev.end.date).getTime();

    stmt.run(ev.id, ownerUserId, ev.organizer?.email || ev.organizer?.displayName || '', start, end, ev.summary || '', Date.now(), JSON.stringify(ev));

    const payload = {
      id: ev.id,
      user_id: ownerUserId,
      calendar_id: ev.organizer?.email || ev.organizer?.displayName || '',
      start,
      end,
      summary: ev.summary || '',
      updated_at: Date.now(),
      raw: ev
    };
    const revStmt = this.db.prepare(`
    INSERT INTO revisions (id, object_type, object_id, seq, payload, created_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `);
    revStmt.run(uuidv4(), 'calendar_events', ev.id, 1, JSON.stringify(payload), Date.now());
  }

  async deleteEventLocal(eventId: string) {
    const stmt = this.db.prepare(`DELETE FROM calendar_events WHERE id = ?`);
    stmt.run(eventId);

    const revStmt = this.db.prepare(`
    INSERT INTO revisions (id, object_type, object_id, seq, payload, created_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `);
    revStmt.run(uuidv4(), 'calendar_events', eventId, 1, JSON.stringify({ deleted: true }), Date.now());
  }
}
