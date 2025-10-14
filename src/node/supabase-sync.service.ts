import { createClient, SupabaseClient } from "@supabase/supabase-js";
import EventEmitter from "events";
import {app, BrowserWindow} from "electron";
import path from "path";
import fs from "fs";
import {attachments} from "../drizzle/shema";
import {shell, dialog} from 'electron';
import {eq} from "drizzle-orm";
import {v4 as uuidv4} from "uuid";

export class SupabaseSyncService extends EventEmitter {
  private client: SupabaseClient;
  private dbService: any;
  private channels: any[] = [];
  private pushTimer?: NodeJS.Timeout;

  constructor(opts: {
    supabaseUrl: string;
    supabaseKey: string;
    db: any;
  }) {
    super();
    this.client = createClient(opts.supabaseUrl, opts.supabaseKey, { auth: { persistSession: false } });
    this.dbService = opts.db;
  }

  async start() {
    console.log("[Sync] Starting realtime sync...");
    const channel = this.client
        .channel("tasks-realtime")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "tasks" },
            (payload) => this.handleRemoteChange("tasks", payload)
        )
        .subscribe((status) => console.log("[Sync] Subscribed:", status));

    this.channels.push(channel);

    // periodic local → cloud push
    this.pushTimer = setInterval(() => {
      this.pushLocalRevisions().catch((err) =>
          console.error("[Sync] pushLocalRevisions error:", err)
      );
    }, 7000);
  }

  async stop() {
    console.log("[Sync] Stopping...");
    if (this.pushTimer) clearInterval(this.pushTimer);
    for (const ch of this.channels) {
      await this.client.removeChannel(ch);
    }
    this.channels = [];
  }

  async handleRemoteChange(table: string, payload: any) {
    const record = payload.new || payload.record;
    if (!record?.id) return;

    const sql = `
      INSERT INTO tasks (id, project_id, title, description, status, assignee, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id=excluded.project_id,
        title=excluded.title,
        description=excluded.description,
        status=excluded.status,
        assignee=excluded.assignee,
        updated_at=excluded.updated_at
    `;
    this.dbService.query(sql, [
      record.id,
      record.project_id,
      record.title,
      record.description,
      record.status,
      record.assignee,
      new Date(record.updated_at).getTime(),
    ]);
    this.emit("remote:applied", { table, record });
  }

  async pushLocalRevisions() {
    const rows = this.dbService.query(
        "SELECT * FROM revisions WHERE synced = 0 LIMIT 50"
    );
    if (!rows.length) return;

    console.log(`[Sync] Pushing ${rows.length} local revisions...`);

    for (const r of rows) {
      try {
        const payload = JSON.parse(r.payload);
        const { error } = await this.client
            .from(r.object_type)
            .upsert(payload, { onConflict: "id" });

        if (!error) {
          this.dbService.query("UPDATE revisions SET synced = 1 WHERE id = ?", [
            r.id,
          ]);
        } else {
          console.error("[Sync] Push error:", error);
        }
      } catch (err) {
        console.error("[Sync] Revision parse error:", err);
      }
    }
  }

  async createAttachment(taskId: string) {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];
    const fileName = path.basename(filePath);
    const fileBuffer = fs.readFileSync(filePath);

    const supabasePath = `tasks/${taskId}/${Date.now()}-${fileName}`;
    const {data, error} = await this.client.storage.from('attachments').upload(supabasePath, fileBuffer);

    if (error) throw error;

    const created_at = new Date().getTime();

    const newAttachment = {
      id: uuidv4(),
      taskId,
      filename: fileName,
      mimetype: 'application/octet-stream',
      size: fs.statSync(filePath).size,
      supabasePath,
      created_at
    };

    const db = this.dbService.getOrm();
    db.insert(attachments).values(newAttachment).run();
    return newAttachment;
  }

  async downloadAttachment(supabasePath: string) {
    const { data, error } = await this.client.storage.from('attachments').download(supabasePath);
    if (error) throw error;

    const tmpFile = path.join(app.getPath('temp'), path.basename(supabasePath));
    fs.writeFileSync(tmpFile, Buffer.from(await data.arrayBuffer()));

    await shell.openPath(tmpFile);
    return tmpFile;
  }

  async listAttachments(taskId: string) {
    const db = this.dbService.getOrm();
    return db.select().from(attachments).where(eq(attachments.taskId, taskId)).all();
  }
}
