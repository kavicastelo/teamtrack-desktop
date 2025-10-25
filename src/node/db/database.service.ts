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
                                            updated_at INTEGER
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
                                         last_calendar_sync INTEGER
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
        created_at INTEGER
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
                                                   calendar_id TEXT,
                                                   start INTEGER,
                                                   end INTEGER,
                                                   summary TEXT,
                                                   updated_at INTEGER
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
                                              metadata TEXT
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
        `INSERT INTO tasks (id, project_id, title, description, status, assignee, updated_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        id,
        payload.project_id || null,
        payload.title,
        payload.description || "",
        payload.status || "todo",
        payload.assignee || null,
        now,
        now
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
    const now = Date.now();
    payload.updated_at = now;
    const title = payload.title || "Untitled Task";
    payload.title = title;
    const description = payload.description || "";
    payload.description = description;
    const status = payload.status || "todo";
    payload.status = status;
    const assignee = payload.assignee || null;
    payload.assignee = assignee;

    const stmt = this.db!.prepare(`
    UPDATE tasks
    SET project_id = ?, title = ?, description = ?, status = ?, assignee = ?, updated_at = ?, created_at = ?
    WHERE id = ?
  `);
    stmt.run(
        payload.project_id || null,
        title,
        description || "",
        status || "todo",
        assignee || null,
        now,
        payload.created_at,
        payload.id
    );

    // Insert revision for sync
    this.db!.prepare(
        `INSERT INTO revisions (id, object_type, object_id, seq, payload, created_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, 0)`
    ).run(
        crypto.randomUUID(),
        "tasks",
        payload.id,
        Date.now(),
        JSON.stringify(payload),
        now
    );

    return { ...payload, updated_at: now };
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
    INSERT INTO projects (id, name, description, owner_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, payload.name, payload.description || '', payload.owner_id || null, now, now);

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
    UPDATE projects SET name=?, description=?, updated_at=? WHERE id=?
  `).run(payload.name, payload.description || '', now, payload.id);

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
    INSERT INTO users (id, email, full_name, role, avatar_url, timezone, calendar_sync_enabled, google_calendar_id, available_times, updated_at, invited_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, payload.email, '', payload.role, '', '', 0, '', '', now, now);

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
      UPDATE users SET * WHERE id=?
    `).run(payload, payload.id);
    return { ...payload, updated_at: now };
  }

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
  async saveEventsLocally(events: any[]) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO calendar_events
      (id, calendar_id, start, end, summary, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const revStmt = this.db.prepare(`
      INSERT INTO revisions (id, object_type, object_id, seq, payload, created_at, synced)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `);

    for (const ev of events) {
      const start = new Date(ev.start.dateTime || ev.start.date).getTime();
      const end = new Date(ev.end.dateTime || ev.end.date).getTime();

      stmt.run(
          ev.id,
          ev.organizer?.email || '',
          start,
          end,
          ev.summary || '',
          Date.now()
      );

      revStmt.run(uuidv4(), 'calendar_events', ev.id, 1, JSON.stringify(ev), Date.now());
    }
  }
}
