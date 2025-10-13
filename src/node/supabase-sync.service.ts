import { createClient, SupabaseClient } from '@supabase/supabase-js';
import EventEmitter from 'events';

export class SupabaseSyncService extends EventEmitter {
  private client: SupabaseClient;
  private dbService: any;
  private subs: any[] = [];
  private running = false;

  private pushInterval: any;

  constructor(opts: { supabaseUrl: string; supabaseKey: string; db: any }) {
    super();
    this.client = createClient(opts.supabaseUrl, opts.supabaseKey);
    this.dbService = opts.db;
  }

  async start() {
    this.running = true;
    // Subscribe to tasks table
    const taskSub = this.client
      .channel('public:tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, payload => {
        this.handleRemoteChange('tasks', payload);
      })
      .subscribe();
    this.subs.push(taskSub);

    // Periodically push local revisions to Supabase
    this.pushInterval = setInterval(() => this.pushLocalRevisions(), 2000);
  }

  async stop() {
    this.running = false;
    if (this.subs.length) {
      this.subs.forEach(s => s.unsubscribe());
      this.subs = [];
    }
    if (this.pushInterval) clearInterval(this.pushInterval);
  }

  private async handleRemoteChange(table: string, payload: any) {
    // Example: upsert into local DB
    const record = payload.record;
    // Basic LWW conflict resolution by updated_at or updated_at timestamp
    // Here we trust remote: just upsert
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
    await this.dbService.query(sql, [record.id, record.project_id, record.title, record.description, record.status, record.assignee, new Date(record.updated_at).getTime()]);
    // emit to renderer so UI can update
    this.emit('remote:applied', { table, record });
  }

  private async pushLocalRevisions() {
    // Read local 'revisions' table for unsynced items
    const rows = this.dbService.query('SELECT * FROM revisions WHERE synced IS NULL OR synced = 0 LIMIT 100');
    if (!rows.length) return;
    for (const r of rows) {
      // upsert to supabase (example logic)
      const { error } = await this.client.from(r.object_type).upsert(JSON.parse(r.payload));
      if (!error) {
        this.dbService.query('UPDATE revisions SET synced = 1 WHERE id = ?', [r.id]);
      } else {
        console.error('Push error', error);
      }
    }
  }
}
