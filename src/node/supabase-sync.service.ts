import { createClient } from "@supabase/supabase-js";
import EventEmitter from "events";

export class SupabaseSyncService extends EventEmitter {
  private client;
  private dbService;
  private subs = [];
  private pushInterval?: NodeJS.Timeout;

  constructor(opts: any) {
    super();
    this.client = createClient(opts.supabaseUrl, opts.supabaseKey);
    this.dbService = opts.db;
  }

  async start() {
    console.log("[Sync] Starting Supabase sync...");
    const taskSub = this.client
        .channel("public:tasks")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "tasks" },
            (payload) => this.handleRemoteChange("tasks", payload)
        )
        .subscribe();

    this.subs.push(taskSub);
    this.pushInterval = setInterval(
        () => this.pushLocalRevisions(),
        5000 // push every 5s
    );
  }

  async stop() {
    console.log("[Sync] Stopping Supabase sync...");
    this.subs.forEach((s) => s.unsubscribe());
    this.subs = [];
    if (this.pushInterval) clearInterval(this.pushInterval);
  }

  async handleRemoteChange(table: string, payload: any) {
    const record = payload.record;
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
    await this.dbService.query(sql, [
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
        "SELECT * FROM revisions WHERE synced IS NULL OR synced = 0 LIMIT 100"
    );
    if (!rows.length) return;

    console.log(`[Sync] Pushing ${rows.length} local revisions...`);

    for (const r of rows) {
      const { error } = await this.client
          .from(r.object_type)
          .upsert(JSON.parse(r.payload));
      if (!error) {
        this.dbService.query("UPDATE revisions SET synced = 1 WHERE id = ?", [
          r.id,
        ]);
      } else {
        console.error("[Sync] Push error:", error);
      }
    }
  }
}
