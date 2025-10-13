import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'fs';
import crypto from 'crypto';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
// Simple AES-256-GCM encryption helper (example; store key securely!)
const ALGO = 'aes-256-gcm';
function decryptBuffer(encrypted, key) {
    const iv = encrypted.slice(0, 12);
    const tag = encrypted.slice(12, 28);
    const ciphertext = encrypted.slice(28);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
function encryptBuffer(plain, key) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ciphertext]);
}
export class DatabaseService {
    encryptedPath;
    db;
    orm;
    key;
    constructor(opts) {
        this.encryptedPath = opts.dbPath;
        // derive 32-byte key from passphrase (use proper KDF)
        this.key = crypto.createHash('sha256').update(opts.encryptionKey).digest();
    }
    async open() {
        // read encrypted file (if exists)
        if (fs.existsSync(this.encryptedPath)) {
            const encrypted = fs.readFileSync(this.encryptedPath);
            const plain = decryptBuffer(encrypted, this.key);
            // write to secure temp file
            const tmpPath = path.join(os.tmpdir(), `teamtrack-${uuidv4()}.db`);
            fs.writeFileSync(tmpPath, plain, { mode: 0o600 });
            this.db = new Database(tmpPath, { verbose: console.log });
            this.orm = drizzle(this.db);
            // optionally delete plain buffer from memory
        }
        else {
            // create new plain DB
            const tmpPath = path.join(os.tmpdir(), `teamtrack-${uuidv4()}.db`);
            this.db = new Database(tmpPath, { verbose: console.log });
            this.orm = drizzle(this.db);
            // initialize tables (run migrations)
            await this.initSchema();
            // persist encrypted immediately
            await this.close(); // will encrypt and create encryptedPath
            // reopen
            await this.open();
        }
    }
    async initSchema() {
        // Example create table via raw SQL or use drizzle migrations
        this.db.exec(`
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
         created_at INTEGER
      );
    `);
    }
    async close() {
        if (!this.db)
            return;
        const file = this.db.name; // better-sqlite3 stores path in .name
        this.db.close();
        // read plain db file
        const plain = fs.readFileSync(file);
        // encrypt
        const enc = encryptBuffer(plain, this.key);
        fs.writeFileSync(this.encryptedPath, enc, { mode: 0o600 });
        // delete plaintext DB file
        try {
            fs.unlinkSync(file);
        }
        catch (e) { }
    }
    // Example API methods
    query(sql, params) {
        const stmt = this.db.prepare(sql);
        if (/^\s*select/i.test(sql))
            return stmt.all(params);
        return stmt.run(params);
    }
    createTask(payload) {
        const id = payload.id || uuidv4();
        const now = Date.now();
        const stmt = this.db.prepare(`
      INSERT INTO tasks (id, project_id, title, description, status, assignee, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, payload.project_id || null, payload.title, payload.description || '', payload.status || 'todo', payload.assignee || null, now);
        return { id, ...payload, updated_at: now };
    }
    async logEvent(e) {
        const id = uuidv4();
        const stmt = this.db.prepare(`
      INSERT INTO events (id, actor, action, object_type, object_id, payload, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, e.actor || null, e.action, e.object_type || null, e.object_id || null, JSON.stringify(e.payload || {}), Date.now());
    }
}
//# sourceMappingURL=database.service.js.map