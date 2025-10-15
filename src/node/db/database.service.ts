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
        console.log("[DB]", message, ...additionalArgs);
      } });
    this.orm = drizzle(this.db);
    await this.ensureSchema();
  }

  private async ensureSchema() {
    this.db!.exec(`
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
        task_id TEXT,
        filename TEXT,
        mimetype TEXT,
        size INTEGER,
        supabase_path TEXT,
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

  listTasks() {
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
        Date.now()
    );
  }
}
