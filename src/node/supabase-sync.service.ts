import {createClient, SupabaseClient} from "@supabase/supabase-js";
import EventEmitter from "events";
import {app, BrowserWindow, shell, dialog} from "electron";
import path from "path";
import fs from "fs";
import {attachments, revisions, users} from "../drizzle/shema";
import {eq} from "drizzle-orm";
import {v4 as uuidv4} from "uuid";
import {URL} from "url";
import dns from "dns/promises";
import Store from "electron-store";
import {uiEventBus} from "../electron/ipc/UiEventBus";

const store = new Store();

export class SupabaseSyncService extends EventEmitter {
    private client: SupabaseClient;
    private readonly supabaseUrl: string;
    private dbService: any;
    private channels: any[] = [];
    private pushTimer?: NodeJS.Timeout;
    private online = true;
    private networkCheckTimer?: NodeJS.Timeout;
    private readonly mainWindow?: BrowserWindow;

    private tableMeta: Record<string, {
        primaryKey: string | string[];
        orderField?: string;
    }> = {
        tasks: { primaryKey: "id", orderField: "updated_at" },
        projects: { primaryKey: "id", orderField: "updated_at" },
        teams: { primaryKey: "id", orderField: "updated_at" },
        users: { primaryKey: "id", orderField: "updated_at" },
        attachments: { primaryKey: "id", orderField: "created_at" },
        team_members: { primaryKey: ["team_id", "user_id"], orderField: "created_at" },
        events: { primaryKey: "id", orderField: "created_at" },
        revisions: { primaryKey: "id", orderField: "created_at" },
        calendar_events: { primaryKey: "id", orderField: "updated_at" },
        time_entries: { primaryKey: "id", orderField: "created_at" },
        notifications: { primaryKey: "id", orderField: "created_at" },
        heartbeats: { primaryKey: "id", orderField: "timestamp" },
    };

    constructor(opts: {
        supabaseUrl: string;
        supabaseKey: string;
        db: any;
        mainWindow?: BrowserWindow;
    }) {
        super();
        this.supabaseUrl = opts.supabaseUrl;
        this.client = createClient(opts.supabaseUrl, opts.supabaseKey, {
            auth: {persistSession: false},
        });
        this.dbService = opts.db;
        this.mainWindow = opts.mainWindow;

        // assume offline until initial check completes (less surprising)
        this.online = true;
    }

    async start() {
        uiEventBus.send("sync:info", {message: "Starting sync..."});
        this.monitorNetwork();
        await this.startRealtimeSub();
        this.startPushLoop();
        uiEventBus.send("app:loaded", true);
    }

    async stop() {
        uiEventBus.send("sync:info", {message: "Stopping sync..."});
        if (this.pushTimer) clearInterval(this.pushTimer);
        if (this.networkCheckTimer) clearInterval(this.networkCheckTimer);

        // remove channels cleanly
        if (this.channels.length) {
            try {
                for (const ch of this.channels) {
                    await this.client.removeChannel(ch);
                }
            } catch (err) {
                uiEventBus.send("sync:warning", {message: "Failed to remove channels on stop"});
            }
        }
        this.channels = [];
    }

    /** Robust network detection with DNS + HTTP fallback; re-subscribes on reconnect */
    private monitorNetwork() {
        if (this.networkCheckTimer) clearTimeout(this.networkCheckTimer);

        const supabaseUrl = this.supabaseUrl || "";
        let host = "supabase.io";

        try {
            if (supabaseUrl) host = new URL(supabaseUrl).hostname || host;
        } catch {
            uiEventBus.send("sync:warning", {message: "Invalid Supabase URL; using fallback host: " + host});
        }

        let consecutiveFailures = 0;
        let consecutiveSuccesses = 0;
        const threshold = 2;
        let checking = false;
        let reconnecting = false;

        const check = async () => {
            if (checking) return;
            checking = true;

            let networkOk = false;

            try {
                await dns.lookup(host);
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 3000);
                try {
                    const healthUrl = `${supabaseUrl}/auth/v1/health`;
                    const res = await fetch(healthUrl, {signal: controller.signal});
                    // Any HTTP response means we’re online, even if 401/403/etc.
                    if (res.status >= 200 || res.status < 600) networkOk = true;
                } catch {
                    // DNS OK but fetch failed — assume online
                    networkOk = true;
                } finally {
                    clearTimeout(timeout);
                }
            } catch {
                networkOk = false;
            } finally {
                checking = false;
            }

            // Debounce transitions
            if (networkOk) {
                consecutiveSuccesses++;
                consecutiveFailures = 0;

                if (!this.online && consecutiveSuccesses >= threshold) {
                    this.online = true;
                    uiEventBus.send("sync:status", {online: true});

                    if (!reconnecting) {
                        uiEventBus.send("sync:info", {message: "Resuming sync..."});
                        reconnecting = true;
                        try {
                            await this.recreateRealtimeSubscriptions();
                            await this.pushLocalRevisions();
                            await this.pullAllRemoteUpdates();
                        } catch (e) {
                            uiEventBus.send("sync:error", {message: "Failed to reconnect", error: e});
                        } finally {
                            reconnecting = false;
                        }
                    }
                } else {
                    uiEventBus.send("sync:status", {online: true});
                }
            } else {
                consecutiveFailures++;
                consecutiveSuccesses = 0;
                if (this.online && consecutiveFailures >= threshold) {
                    this.online = false;
                    uiEventBus.send("sync:warning", {message: "Offline mode activated"});
                    uiEventBus.send("sync:status", {online: false});
                }
            }
        };

        const loop = async () => {
            await check().catch(console.error);
            this.networkCheckTimer = setTimeout(loop, 10000);
        };

        loop().then();
    }

    private async recreateRealtimeSubscriptions() {
        try {
            for (const old of this.channels) {
                await this.client.removeChannel(old);
            }
            this.channels = [];
            await this.startRealtimeSub();
        } catch (err) {
            uiEventBus.send("sync:error", {message: "Failed to recreate subscriptions", error: err});
        }
    }

    /** Start periodic local → cloud push */
    private startPushLoop() {
        if (this.pushTimer) clearInterval(this.pushTimer);
        this.pushTimer = setInterval(() => {
            if (this.online) {
                this.pushLocalRevisions().catch((err) => console.error("[Sync] pushLocalRevisions error:", err));
            } else {
                uiEventBus.send("sync:info", {message: "Skipping push (offline)"});
            }
        }, 7000);
    }

    /** 📡 Subscribe to realtime task changes */
    async startRealtimeSub() {
        const channels = ["tasks", "revisions", "projects", "teams", "attachments", "events", "users", "team_members", "calendar_events", "time_entries", "heartbeats", "notifications"];

        for (const channel of channels) {
            try {
                const ch = this.client
                    .channel("public:" + channel)
                    // postgres_changes still uses 3 arguments
                    .on("postgres_changes",
                        { event: "*", schema: "public", table: channel },
                        (payload) => this.handleRemoteChange(channel, payload)
                    )
                // event listeners only take 2 arguments now
                // .on("error", (e: any) => console.warn("[Sync] realtime channel error:", e))
                // .on("close", () => console.debug("[Sync] realtime channel closed"));

                await ch.subscribe((status) => {
                    if (status === "SUBSCRIBED") {
                        uiEventBus.send("sync:success", {message: "Realtime subscription active for " + channel});
                        uiEventBus.send("sync:status", {realtime: "connected"});
                    }
                });

                this.channels.push(ch);
            } catch (err) {
                uiEventBus.send("sync:error", {message: "Failed to start realtime subscription", error: err});
                uiEventBus.send("sync:status", {realtime: "error", message: String(err)});
            }
        }
    }

    /** Handle incoming remote change */
    async handleRemoteChange(table: string, payload: any) {
        const { new: newRow, old: oldRow, eventType } = payload;

        try {
            if (eventType === "DELETE") {
                this.deleteRow(table, oldRow);
                uiEventBus.send("sync:remoteDelete", { table, oldRow });
                return;
            }

            if (!newRow) return;

            this.upsertRow(table, newRow);
            uiEventBus.send("sync:remoteUpdate", { table, record: newRow });

        } catch (err) {
            uiEventBus.send("sync:error", {
                table,
                message: "Failed to handle remote change",
                error: String(err)
            });
        }
    }

    private upsertRow(table: string, record: any) {
        const db = this.dbService.db;
        const meta = this.tableMeta[table];
        if (!meta) return;

        const cols = Object.keys(record);
        const placeholders = cols.map(() => "?").join(",");
        const updates = cols.map(c => `${c}=excluded.${c}`).join(",");
        const values = cols.map(c => record[c]);

        const pk = Array.isArray(meta.primaryKey)
            ? meta.primaryKey.join(",")
            : meta.primaryKey;

        const sql = `
        INSERT INTO ${table} (${cols.join(",")})
        VALUES (${placeholders})
        ON CONFLICT(${pk}) DO UPDATE SET ${updates}
    `;

        db.prepare(sql).run(values);
    }

    private deleteRow(table: string, oldRecord: any) {
        const db = this.dbService.db;
        const meta = this.tableMeta[table];
        if (!meta) return;

        const pk = meta.primaryKey;
        if (Array.isArray(pk)) {
            const where = pk.map(k => `${k} = ?`).join(" AND ");
            const values = pk.map(k => oldRecord[k]);
            db.prepare(`DELETE FROM ${table} WHERE ${where}`).run(values);
        } else {
            db.prepare(`DELETE FROM ${table} WHERE ${pk} = ?`).run(oldRecord[pk]);
        }
    }

    async pullAllRemoteUpdates(force=false) {
        const channels = ["tasks", "projects", "teams", "revisions", "attachments", "events", "users", "team_members", "calendar_events", "time_entries", "heartbeats", "notifications"];
        const db = this.dbService.getDb();
        if (force) {
            // remove all local revisions and tables
            for (const channel of channels) {
                db.prepare(`DELETE FROM ${channel}`).run();
            }
        }
        for (const channel of channels) {
            await this.pullRemoteUpdates(channel);
        }
    }

    /** Pull new/updated records from Supabase */
    async pullRemoteUpdates(table: string) {
        const userId = store.get("currentUserId");
        const CHUNK = 500;

        const orderField = this.tableMeta[table].orderField;
        if (!orderField) {
            uiEventBus.send("sync:error", { message: `Unknown table: ${table}` });
            return;
        }

        let remoteQuery = this.client.from(table).select("*");

        if (table === "heartbeats") {
            if (!userId) return;
            const since = Date.now() - 14 * 24 * 60 * 60 * 1000;
            remoteQuery = remoteQuery.gte("timestamp", since);
        }

        if (table === "events") {
            remoteQuery = remoteQuery.eq("actor", userId);
        }

        if (table === "notifications") {
            remoteQuery = remoteQuery.eq("user_id", userId);
        }

        let offset = 0;
        let total = 0;

        while (true) {
            const { data, error } = await remoteQuery
                .order(orderField, { ascending: true })
                .range(offset, offset + CHUNK - 1);

            if (error) {
                uiEventBus.send("sync:error", { message: `Failed to pull ${table}`, error });
                return;
            }

            if (!data || data.length === 0) break;

            await this.applyRowsToLocal(table, data, orderField);

            total += data.length;
            offset += CHUNK;

            if (total % 1000 === 0) {
                uiEventBus.send("sync:progress", { table, total });
            }

            if (data.length < CHUNK) break;
        }

        uiEventBus.send("sync:success", {
            table,
            total,
            message: `Pulled ${total} ${table} rows`,
        });
    }

    private async applyRowsToLocal(
        table: string,
        rows: any[],
        orderField: string
    ) {
        const db = this.dbService.db;

        const columns = Object.keys(rows[0]);
        const placeholders = columns.map(() => "?").join(",");
        const updateSet = columns.map(c => `${c}=excluded.${c}`).join(",");

        const insert = db.prepare(`
        INSERT INTO ${table} (${columns.join(",")})
        VALUES (${placeholders})
        ON CONFLICT(id) DO UPDATE SET ${updateSet}
    `);

        const select = db.prepare(
            `SELECT ${orderField} FROM ${table} WHERE id = ?`
        );

        const tx = db.transaction((batch: any[]) => {
            for (const r of batch) {
                const local = select.get(r.id);

                // Compare using the actual order field
                if (!local || r[orderField] > local[orderField]) {
                    insert.run(...columns.map(c => r[c]));
                }
            }
        });

        tx(rows);
    }

    /** Push local revisions with retry queue */
    async pushLocalRevisions() {
        try {
            const rows = this.dbService.query("SELECT * FROM revisions WHERE synced = 0 LIMIT 500"); // can safely increase batch size
            if (!rows || rows.length === 0) return;

            // Define "background/system" object types
            const silentTypes = new Set(["heartbeats", "calendar_events", "time_entries", "events", "notifications"]);

            // Separate into user vs system revisions
            const userRows = rows.filter(r => !silentTypes.has(r.object_type));
            const backgroundRows = rows.filter(r => silentTypes.has(r.object_type));

            if (userRows.length) {
                uiEventBus.send("sync:info", { message: `Pushing ${userRows.length} user revisions...` });
            }

            // Group revisions by object_type
            const grouped = {};
            for (const r of rows) {
                try {
                    const payload = JSON.parse(r.payload);
                    if (!grouped[r.object_type]) grouped[r.object_type] = [];
                    grouped[r.object_type].push({ ...payload, _revision_id: r.id }); // include local id for tracking
                } catch (err) {
                    this.queueRetry(r);
                }
            }

            let totalSynced = 0;
            let backgroundCount = 0;

            // Bulk upload per object type
            for (const [objectType, records] of Object.entries(grouped)) {
                if (!Array.isArray(records)) continue;

                const { data, error } = await this.client
                    .from(objectType)
                    .upsert(records.map(r => {
                        // remove internal revision id before uploading if not needed remotely
                        const { _revision_id, ...rest } = r;
                        return rest;
                    }), { onConflict: "id" });

                if (error) {
                    // If the bulk upload fails, fallback to retry each record
                    uiEventBus.send("sync:warning", { message: `Bulk sync failed for ${objectType}: ${error.message}` });
                    for (const rec of records) {
                        this.queueRetry({ object_type: objectType, id: rec._revision_id });
                    }
                    continue;
                }

                // Mark all uploaded revisions as synced
                const syncedIds = records.map(r => r._revision_id);
                const placeholders = syncedIds.map(() => "?").join(",");
                this.dbService.query(`UPDATE revisions SET synced = 1 WHERE id IN (${placeholders})`, syncedIds);

                totalSynced += records.length;
                if (silentTypes.has(objectType)) backgroundCount += records.length;
                else uiEventBus.send("sync:success", { message: `Synced ${records.length} ${objectType} revisions` });
            }

            if (backgroundCount > 0) {
                uiEventBus.send("sync:summary", {
                    message: `Synced ${backgroundCount} background revisions (${Array.from(silentTypes).join(", ")})`
                });
            }

            if (totalSynced > 50)
                uiEventBus.send("sync:info", { message: `Push complete — ${totalSynced} total revisions synced.` });

        } catch (err) {
            uiEventBus.send("sync:error", { message: "Failed to push local revisions", error: err });
        }
    }

    /** Retry mechanism with exponential backoff */
    private queueRetry(rev: any) {
        const retryCount = rev.retryCount || 0;
        const MAX_RETRIES = 3;

        if (retryCount >= MAX_RETRIES) {
            uiEventBus.send("sync:warning", {
                message: `Giving up on revision ${rev.id} after ${MAX_RETRIES} retries.`,
            });
            // Optionally mark it as failed permanently
            this.dbService.query("UPDATE revisions SET synced = -1 WHERE id = ?", [rev.id]);
            return;
        }

        const delay = Math.min(60000, Math.pow(2, retryCount) * 1000);
        uiEventBus.send("sync:info", {
            message: `Retrying ${rev.id} (attempt ${retryCount + 1}/${MAX_RETRIES}) in ${delay / 1000}s`,
        });

        setTimeout(async () => {
            try {
                const payload = JSON.parse(rev.payload);
                const { error } = await this.client
                    .from(rev.object_type)
                    .upsert(payload, { onConflict: "id" });

                if (!error) {
                    this.dbService.query("UPDATE revisions SET synced = 1 WHERE id = ?", [rev.id]);
                    uiEventBus.send("sync:success", { message: `Synced revision: ${rev.id}` });
                    return;
                }
                throw error;
            } catch (err) {
                uiEventBus.send("sync:error", {
                    message: `Retry ${retryCount + 1} failed for ${rev.id}: ${err.message}`,
                });
                this.queueRetry({ ...rev, retryCount: retryCount + 1 });
            }
        }, delay);
    }

    async deleteRecord(table: string, where: Record<string, any>) {

        let query = this.client.from(table).delete();

        Object.entries(where).forEach(([field, value]) => {
            query = query.eq(field, value);
        });

        const { error } = await query;

        if (error) {
            uiEventBus.send("sync:error", { message: "Failed to delete record", error });
        }
    }

    /** Upload a new attachment */
    async createAttachment(taskId: string, uploaded_by: string) {
        const win = BrowserWindow.getFocusedWindow();
        const result = await dialog.showOpenDialog(win!, {properties: ["openFile"]});
        if (result.canceled || result.filePaths.length === 0) return null;

        const filePath = result.filePaths[0];
        const fileName = path.basename(filePath);
        const fileBuffer = fs.readFileSync(filePath);
        const supabasePath = `tasks/${taskId}/${Date.now()}-${fileName}`;

        const {data, error} = await this.client.storage.from("attachments").upload(supabasePath, fileBuffer);
        if (error) uiEventBus.send("sync:error", {message: "Failed to upload attachment", error});

        const created_at = Date.now();
        const newAttachment = {
            id: uuidv4(),
            uploaded_by,
            taskId,
            filename: fileName,
            mimetype: "application/octet-stream",
            size: fs.statSync(filePath).size,
            supabase_path: supabasePath,
            created_at,
        };

        const newRevision = {
            id: uuidv4(),
            object_type: "attachments",
            object_id: newAttachment.id,
            seq: 1,
            payload: JSON.stringify(newAttachment),
            created_at,
            synced: 0
        };

        const db = this.dbService.getOrm();
        db.insert(attachments).values(newAttachment).run();
        db.insert(revisions).values(newRevision).run();
        uiEventBus.send("sync:success", {message: "Created attachment: " + newAttachment.id});
        return newAttachment;
    }

    /** Download & open an attachment */
    async openAttachment(supabasePath: string) {
        const {data, error} = await this.client.storage.from("attachments").download(supabasePath);
        if (error) throw error;

        const tmpFile = path.join(app.getPath("temp"), path.basename(supabasePath));
        fs.writeFileSync(tmpFile, Buffer.from(await data.arrayBuffer()));

        await shell.openPath(tmpFile);
        return tmpFile;
    }

    /** Download & let user choose where to save */
    async downloadAttachment(supabasePath: string) {
        const {data, error} = await this.client.storage.from("attachments").download(supabasePath);
        if (error) throw error;

        const filename = path.basename(supabasePath);
        const {canceled, filePath} = await dialog.showSaveDialog({
            defaultPath: path.join(app.getPath("downloads"), filename),
            title: "Save Attachment",
        });

        if (canceled || !filePath) return null;

        fs.writeFileSync(filePath, Buffer.from(await data.arrayBuffer()));
        uiEventBus.send("sync:success", {message: "Downloaded attachment: " + filename});
        shell.showItemInFolder(filePath);
        return filePath;
    }

    /** List attachments for a given task */
    async listAttachments(taskId: string) {
        const db = this.dbService.getOrm();
        if (taskId)
            return db.select().from(attachments).where(eq(attachments.taskId, taskId)).all();
        return db.select().from(attachments).all();
    }

    // private sendToUI(event: string, payload: any) {
    //     try {
    //         if (!this.mainWindow || this.mainWindow.isDestroyed()) {
    //             console.warn(`Cannot send ${event}: mainWindow is not available.`);
    //             return;
    //         }
    //
    //         // Ensure payload is serializable (IPC requires it)
    //         this.mainWindow.webContents.send(event, payload);
    //     } catch (err) {
    //         // Log to console or a file — DO NOT re-send to UI
    //         console.error(`Failed to send event '${event}' to UI:`, err);
    //     }
    // }
}
