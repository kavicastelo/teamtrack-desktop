import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import crypto from "crypto";
import os from "os";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const ALGO = "aes-256-gcm";

/** --- Encryption helpers --- */
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

/** --- Database service --- */
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

  /** Open or create encrypted DB */
  async open() {
    this.tmpPath = path.join(os.tmpdir(), `teamtrack-${uuidv4()}.db`);

    if (fs.existsSync(this.encryptedPath)) {
      try {
        const encrypted = fs.readFileSync(this.encryptedPath);
        const plain = decryptBuffer(encrypted, this.key);
        fs.writeFileSync(this.tmpPath, plain, { mode: 0o600 });
        console.log("[DB] Decrypted existing DB →", this.tmpPath);
      } catch (e) {
        console.error("[DB] Failed to decrypt — starting fresh:", e);
        // fallback: create new DB
        this.tmpPath = path.join(os.tmpdir(), `teamtrack-${uuidv4()}.db`);
      }
    } else {
      console.log("[DB] No encrypted DB found — creating new one");
    }

    this.db = new Database(this.tmpPath, { verbose: console.log });
    this.orm = drizzle(this.db);

    // Always ensure schema and columns exist
    await this.ensureSchema();
  }

  /** Ensure schema and migration safety */
  private async ensureSchema() {
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        title TEXT,
        description TEXT,
        status TEXT,
        assignee TEXT,
        updated_at INTEGER
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
    `);

    // In case older DBs are missing 'synced' column
    try {
      this.db!.exec(`ALTER TABLE revisions ADD COLUMN synced INTEGER DEFAULT 0;`);
    } catch (err: any) {
      if (!String(err.message).includes("duplicate column name")) {
        console.warn("[DB] Migration error:", err.message);
      }
    }

    const tables = this.db!
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all();
    console.log("[DB] Tables available:", tables.map((t:any) => t.name).join(", "));
  }

  /** Close and encrypt */
  async close() {
    if (!this.db) return;

    const dbFile = (this.db as any).name;
    this.db.close();

    const plain = fs.readFileSync(dbFile);
    const encrypted = encryptBuffer(plain, this.key);
    fs.writeFileSync(this.encryptedPath, encrypted, { mode: 0o600 });

    console.log("[DB] Encrypted DB saved at:", this.encryptedPath);

    try {
      fs.unlinkSync(dbFile);
    } catch (e) {
      console.warn("[DB] Temp cleanup failed:", e);
    }
  }

  /** --- Query helpers --- */
  query(sql: string, params?: any[]) {
    if (!this.db) throw new Error("DB not open");
    const bindParams = Array.isArray(params)
        ? params
        : params !== undefined
            ? [params]
            : [];
    const stmt = this.db.prepare(sql);

    if (/^\s*select/i.test(sql)) return stmt.all(...bindParams);
    return stmt.run(...bindParams);
  }

  createTask(payload: any) {
    const id = payload.id || uuidv4();
    const now = Date.now();
    const stmt = this.db!.prepare(`
      INSERT INTO tasks (id, project_id, title, description, status, assignee, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
        id,
        payload.project_id || null,
        payload.title,
        payload.description || "",
        payload.status || "todo",
        payload.assignee || null,
        now
    );
    return { id, ...payload, updated_at: now };
  }

  async logEvent(e: any) {
    const id = uuidv4();
    const stmt = this.db!.prepare(`
      INSERT INTO events (id, actor, action, object_type, object_id, payload, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
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
