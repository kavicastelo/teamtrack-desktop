import { createClient, SupabaseClient } from "@supabase/supabase-js";
import EventEmitter from "events";
import { app, BrowserWindow, shell, dialog } from "electron";
import path from "path";
import fs from "fs";
import { attachments } from "../drizzle/shema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import dns from "dns";
import { URL } from "url";

export class SupabaseSyncService extends EventEmitter {
  private client: SupabaseClient;
  private readonly supabaseUrl: string;
  private dbService: any;
  private channels: any[] = [];
  private pushTimer?: NodeJS.Timeout;
  private online = true;
  private networkCheckTimer?: NodeJS.Timeout;
  private readonly mainWindow?: BrowserWindow;

  constructor(opts: {
    supabaseUrl: string;
    supabaseKey: string;
    db: any;
    mainWindow?: BrowserWindow;
  }) {
    super();
    this.supabaseUrl = opts.supabaseUrl;
    this.client = createClient(opts.supabaseUrl, opts.supabaseKey, {
      auth: { persistSession: false },
    });
    this.dbService = opts.db;
    this.mainWindow = opts.mainWindow;

    // assume offline until initial check completes (less surprising)
    this.online = true;
  }

  async start() {
    console.log("[Sync] Starting realtime sync...");
    this.monitorNetwork();
    await this.startRealtimeSub();
    this.startPushLoop();
  }

  async stop() {
    console.log("[Sync] Stopping...");
    if (this.pushTimer) clearInterval(this.pushTimer);
    if (this.networkCheckTimer) clearInterval(this.networkCheckTimer);

    // remove channels cleanly
    if (this.channels.length) {
      try {
        for (const ch of this.channels) {
          await this.client.removeChannel(ch);
        }
      } catch (err) {
        console.warn("[Sync] Warning removing channels on stop:", err);
      }
    }
    this.channels = [];
  }

  /** Robust network detection with DNS + HTTP fallback; re-subscribes on reconnect */
  private monitorNetwork() {
    const supabaseUrl = this.supabaseUrl || "";
    let host = "supabase.io";

    try {
      if (supabaseUrl) host = new URL(supabaseUrl).hostname || host;
    } catch {
      console.warn("[Sync] Invalid Supabase URL; using fallback host:", host);
    }

    let consecutiveFailures = 0;
    let consecutiveSuccesses = 0;
    const threshold = 2; // how many checks in a row before changing status

    const check = async () => {
      let networkOk = false;

      try {
        // DNS check
        await new Promise<void>((resolve, reject) => {
          dns.lookup(host, (err) => (err ? reject(err) : resolve()));
        });

        // Optional HTTP check
        if (supabaseUrl && typeof fetch !== "undefined") {
          const controller = typeof AbortController !== "undefined" ? new AbortController() : undefined;
          const timeout = setTimeout(() => controller?.abort(), 3000);
          try {
            await fetch(supabaseUrl, { method: "HEAD", signal: controller?.signal });
            networkOk = true;
          } catch {
            // HEAD failed but DNS OK — still online
            networkOk = true;
          } finally {
            clearTimeout(timeout);
          }
        } else {
          networkOk = true;
        }
      } catch {
        networkOk = false;
      }

      // Debounce logic
      if (networkOk) {
        consecutiveSuccesses++;
        consecutiveFailures = 0;

        if (!this.online && consecutiveSuccesses >= threshold) {
          this.online = true;
          console.log("[Sync] ✅ Back online — resuming sync...");
          this.sendToUI("sync:status", { online: true });
          await this.recreateRealtimeSubscriptions();
          this.pushLocalRevisions().catch((e) => console.error("[Sync] resume push error:", e));
          this.pullRemoteUpdates().catch((e) => console.error("[Sync] resume pull error:", e));
        }
      } else {
        consecutiveFailures++;
        consecutiveSuccesses = 0;

        if (this.online && consecutiveFailures >= threshold) {
          this.online = false;
          console.warn("[Sync] ⚠️ Offline mode activated.");
          this.sendToUI("sync:status", { online: false });
        }
      }
    };

    check().catch((e) => console.error("[Sync] Initial network check failed:", e));
    this.networkCheckTimer = setInterval(() => check().catch(console.error), 10000);
  }

  private async recreateRealtimeSubscriptions() {
    try {
      for (const old of this.channels) {
        await this.client.removeChannel(old);
      }
      this.channels = [];
      await this.startRealtimeSub();
    } catch (err) {
      console.error("[Sync] Failed to recreate subscriptions:", err);
    }
  }

  /** Start periodic local → cloud push */
  private startPushLoop() {
    if (this.pushTimer) clearInterval(this.pushTimer);
    this.pushTimer = setInterval(() => {
      if (this.online) {
        this.pushLocalRevisions().catch((err) => console.error("[Sync] pushLocalRevisions error:", err));
      } else {
        console.log("[Sync] Skipping push (offline)");
      }
    }, 7000);
  }

  /** Handle incoming remote change */
  async handleRemoteChange(table: string, payload: any) {
    const record = payload.new || payload.record;
    if (!record?.id) return;

    try {
      const sql = `
      INSERT INTO tasks (id, project_id, title, description, status, assignee, updated_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id=excluded.project_id,
        title=excluded.title,
        description=excluded.description,
        status=excluded.status,
        assignee=excluded.assignee,
        updated_at=excluded.updated_at,
        created_at=excluded.created_at
    `;
      this.dbService.query(sql, [
        record.id,
        record.project_id,
        record.title,
        record.description,
        record.status,
        record.assignee,
        new Date(record.updated_at).getTime(),
        record.created_at,
      ]);

      this.sendToUI("sync:remoteUpdate", record);
    } catch (err) {
      console.error("[Sync] handleRemoteChange error:", err);
    }
  }

  /** 📡 Subscribe to realtime task changes */
  async startRealtimeSub() {
    try {
      const ch = this.client
          .channel("public:tasks")
          // postgres_changes still uses 3 arguments
          .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "tasks" },
              (payload) => this.handleRemoteChange("tasks", payload)
          )
          // event listeners only take 2 arguments now
          // .on("error", (e: any) => console.warn("[Sync] realtime channel error:", e))
          // .on("close", () => console.debug("[Sync] realtime channel closed"));

      await ch.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("[Sync] ✅ Realtime subscription active for tasks");
          this.sendToUI("sync:status", { realtime: "connected" });
        }
      });

      this.channels.push(ch);
    } catch (err) {
      console.error("[Sync] startRealtimeSub failed:", err);
      this.sendToUI("sync:status", { realtime: "error", message: String(err) });
    }
  }

  /** Pull new/updated records from Supabase */
  async pullRemoteUpdates() {
    try {
      const { data, error } = await this.client.from("tasks").select("*").order("updated_at", { ascending: true });
      if (error) throw error;
      if (!Array.isArray(data)) return;

      for (const record of data) {
        const local = this.dbService.prepare("SELECT * FROM tasks WHERE id = ?").get(record.id);
        if (!local || new Date(record.updated_at).getTime() > new Date(local.updated_at).getTime()) {
          this.dbService
              .prepare(
                  `INSERT INTO tasks (id, project_id, title, description, status, assignee, updated_at, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 project_id=excluded.project_id,
                 title=excluded.title,
                 description=excluded.description,
                 status=excluded.status,
                 assignee=excluded.assignee,
                 updated_at=excluded.updated_at
                 created_at=excluded.created_at`
              )
              .run(record.id, record.project_id, record.title, record.description, record.status, record.assignee, record.updated_at);
        }
      }

      this.sendToUI("sync:pull", { count: data.length });
      console.log(`[Sync] Pulled ${data.length} records`);
    } catch (err) {
      console.error("[Sync] Pull failed:", err);
    }
  }

  /** Push local revisions with retry queue */
  async pushLocalRevisions() {
    try {
      const rows = this.dbService.query("SELECT * FROM revisions WHERE synced = 0 LIMIT 50");
      if (!rows || rows.length === 0) return;

      console.log(`[Sync] Pushing ${rows.length} local revisions...`);
      for (const r of rows) {
        try {
          const payload = JSON.parse(r.payload);
          const { error } = await this.client.from(r.object_type).upsert(payload, { onConflict: "id" });

          if (!error) {
            this.dbService.query("UPDATE revisions SET synced = 1 WHERE id = ?", [r.id]);
            console.log("[Sync] ✅ Synced revision:", r.id);
          } else {
            console.warn("[Sync] Push failed:", error.message ?? error);
            this.queueRetry(r);
          }
        } catch (err) {
          console.error("[Sync] Revision parse or push error:", err);
          this.queueRetry(r);
        }
      }
    } catch (err) {
      console.error("[Sync] pushLocalRevisions top-level error:", err);
    }
  }

  /** Retry mechanism with exponential backoff */
  private queueRetry(rev: any) {
    const retryCount = rev.retryCount || 0;
    const delay = Math.min(60000, Math.pow(2, retryCount) * 1000);

    console.log(`[Sync] Queuing retry for ${rev.id} (in ${delay} ms)`);

    setTimeout(async () => {
      try {
        const payload = JSON.parse(rev.payload);
        const { error } = await this.client.from(rev.object_type).upsert(payload, { onConflict: "id" });

        if (!error) {
          this.dbService.query("UPDATE revisions SET synced = 1 WHERE id = ?", [rev.id]);
          console.log("[Sync] ✅ Retry succeeded:", rev.id);
          return;
        }
        throw error;
      } catch (err) {
        console.error("[Sync] Retry failed for", rev.id, err);
        // schedule again
        this.queueRetry({ ...rev, retryCount: retryCount + 1 });
      }
    }, delay);
  }

  /** Upload a new attachment */
  async createAttachment(taskId: string) {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win!, { properties: ["openFile"] });
    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];
    const fileName = path.basename(filePath);
    const fileBuffer = fs.readFileSync(filePath);
    const supabasePath = `tasks/${taskId}/${Date.now()}-${fileName}`;

    const { data, error } = await this.client.storage.from("attachments").upload(supabasePath, fileBuffer);
    if (error) throw error;

    const created_at = new Date().getTime();
    const newAttachment = {
      id: uuidv4(),
      taskId,
      filename: fileName,
      mimetype: "application/octet-stream",
      size: fs.statSync(filePath).size,
      supabasePath,
      created_at,
    };

    const db = this.dbService.getOrm();
    db.insert(attachments).values(newAttachment).run();
    return newAttachment;
  }

  /** Download & open an attachment */
  async downloadAttachment(supabasePath: string) {
    const { data, error } = await this.client.storage.from("attachments").download(supabasePath);
    if (error) throw error;

    const tmpFile = path.join(app.getPath("temp"), path.basename(supabasePath));
    fs.writeFileSync(tmpFile, Buffer.from(await data.arrayBuffer()));

    await shell.openPath(tmpFile);
    return tmpFile;
  }

  /** List attachments for a given task */
  async listAttachments(taskId: string) {
    const db = this.dbService.getOrm();
    return db.select().from(attachments).where(eq(attachments.taskId, taskId)).all();
  }

  private sendToUI(event: string, payload: any) {
    if (!this.mainWindow) {
      console.warn(`[Sync] Attempted to send ${event} but mainWindow is not set`);
      return;
    }
    try {
      this.mainWindow.webContents.send(event, payload);
    } catch (err) {
      console.error("[Sync] sendToUI error:", err);
    }
  }
}
