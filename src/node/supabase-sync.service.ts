import {createClient, SupabaseClient} from "@supabase/supabase-js";
import EventEmitter from "events";
import {app, BrowserWindow, shell, dialog} from "electron";
import path from "path";
import fs from "fs";
import {attachments, revisions} from "../drizzle/shema";
import {eq} from "drizzle-orm";
import {v4 as uuidv4} from "uuid";
import {URL} from "url";
import dns from "dns/promises";
import Store from "electron-store";
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
        this.sendToUI("sync:info", {message: "Starting sync..."});
        this.monitorNetwork();
        await this.startRealtimeSub();
        this.startPushLoop();
    }

    async stop() {
        this.sendToUI("sync:info", {message: "Stopping sync..."});
        if (this.pushTimer) clearInterval(this.pushTimer);
        if (this.networkCheckTimer) clearInterval(this.networkCheckTimer);

        // remove channels cleanly
        if (this.channels.length) {
            try {
                for (const ch of this.channels) {
                    await this.client.removeChannel(ch);
                }
            } catch (err) {
                this.sendToUI("sync:warning", {message: "Failed to remove channels on stop"});
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
            this.sendToUI("sync:warning", {message: "Invalid Supabase URL; using fallback host: "+host});
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
                    this.sendToUI("sync:status", {online: true});

                    if (!reconnecting) {
                        this.sendToUI("sync:info", {message: "Resuming sync..."});
                        reconnecting = true;
                        try {
                            await this.recreateRealtimeSubscriptions();
                            await this.pushLocalRevisions();
                            await this.pullAllRemoteUpdates();
                        } catch (e) {
                            this.sendToUI("sync:error", {message: "Failed to reconnect", error: e});
                        } finally {
                            reconnecting = false;
                        }
                    }
                } else {
                    this.sendToUI("sync:status", {online: true});
                }
            } else {
                consecutiveFailures++;
                consecutiveSuccesses = 0;
                if (this.online && consecutiveFailures >= threshold) {
                    this.online = false;
                    this.sendToUI("sync:warning", {message: "Offline mode activated"});
                    this.sendToUI("sync:status", {online: false});
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
            this.sendToUI("sync:error", {message: "Failed to recreate subscriptions", error: err});
        }
    }

    /** Start periodic local → cloud push */
    private startPushLoop() {
        if (this.pushTimer) clearInterval(this.pushTimer);
        this.pushTimer = setInterval(() => {
            if (this.online) {
                this.pushLocalRevisions().catch((err) => console.error("[Sync] pushLocalRevisions error:", err));
            } else {
                this.sendToUI("sync:info", {message: "Skipping push (offline)"});
            }
        }, 7000);
    }

    /** Handle incoming remote change */
    async handleRemoteChange(table: string, payload: any) {
        const record = payload.new || payload.record;
        if (!record?.id) return;

        if (table === 'tasks') {
            try {
                const sql = `
                    INSERT INTO tasks (id, project_id, title, description, status, assignee, updated_at, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO
                    UPDATE SET
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
                this.sendToUI("sync:error", {message: "Failed to handle remote change", error: err});
            }
        } else if (table === 'revisions') {
            try {
                const sql = `
                    INSERT INTO revisions (id, object_type, object_id, seq, payload, created_at, synced)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO
                    UPDATE SET
                        object_type=excluded.object_type,
                        object_id=excluded.object_id,
                        seq=excluded.seq,
                        payload=excluded.payload,
                        created_at=excluded.created_at,
                        synced=excluded.synced
                `;
                this.dbService.query(sql, [
                    record.id,
                    record.object_type,
                    record.object_id,
                    record.seq,
                    record.payload,
                    record.created_at,
                    record.synced,
                ]);

                this.sendToUI("sync:remoteUpdate", record);
            } catch (err) {
                this.sendToUI("sync:error", {message: "Failed to handle remote change", error: err});
            }
        } else if (table === 'projects') {
            try {
                const sql = `
                    INSERT INTO projects (id, name, description, owner_id, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO
                    UPDATE SET
                        name=excluded.title,
                        description=excluded.description,
                        owner_id=excluded.owner_id,
                        created_at=excluded.created_at,
                        updated_at=excluded.updated_at
                `;
                this.dbService.query(sql, [
                    record.id,
                    record.name,
                    record.description,
                    record.owner_id,
                    record.created_at,
                    record.updated_at,
                ]);

                this.sendToUI("sync:remoteUpdate", record);
            } catch (err) {
                this.sendToUI("sync:error", {message: "Failed to handle remote change", error: err});
            }
        } else if (table === 'teams') {
            try {
                const sql = `
                    INSERT INTO teams (id, project_id, name, description, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO
                    UPDATE SET
                        project_id=excluded.project_id,
                        name =excluded.name,
                        description=excluded.description,
                        created_at=excluded.created_at,
                        updated_at=excluded.updated_at
                `;
                this.dbService.query(sql, [
                    record.id,
                    record.project_id,
                    record.name,
                    record.description,
                    record.created_at,
                    record.updated_at,
                ]);

                this.sendToUI("sync:remoteUpdate", record);
            } catch (err) {
                this.sendToUI("sync:error", {message: "Failed to handle remote change", error: err});
            }
        } else if (table === 'users') {
            try {
                const sql = `
                    INSERT INTO users (id, email, full_name, role, avatar_url, timezone, calendar_sync_enabled, google_calendar_id, available_times, updated_at, invited_at, google_refresh_token, last_calendar_sync)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO 
                    UPDATE SET
                        email=excluded.email,
                        full_name=excluded.full_name,
                        role=excluded.role,
                        avatar_url=excluded.avatar_url,
                        timezone=excluded.timezone,
                        calendar_sync_enabled=excluded.calendar_sync_enabled,
                        google_calendar_id=excluded.google_calendar_id,
                        available_times=excluded.available_times,
                        updated_at=excluded.updated_at,
                        invited_at=excluded.invited_at,
                        google_refresh_token=excluded.google_refresh_token,
                        last_calendar_sync=excluded.last_calendar_sync
                `;
                this.dbService.query(sql, [
                    record.id,
                    record.email,
                    record.full_name,
                    record.role,
                    record.avatar_url,
                    record.timezone,
                    record.calendar_sync_enabled,
                    record.google_calendar_id,
                    record.available_times,
                    record.updated_at,
                    record.invited_at,
                    record.google_refresh_token,
                    record.last_calendar_sync
                ]);

                this.sendToUI("sync:remoteUpdate", record);
            } catch (err) {
                this.sendToUI("sync:error", {message: "Failed to handle remote change", error: err});
            }
        } else if (table === 'team_members') {
            try {
                const sql = `
                    INSERT INTO team_members (id, team_id, user_id, role, created_at)
                    VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO
                    UPDATE SET
                        id=excluded.id,
                        team_id=excluded.team_id,
                        user_id=excluded.user_id,
                        role=excluded.role,
                        created_at=excluded.created_at
                `;
                this.dbService.query(sql, [
                    record.id,
                    record.team_id,
                    record.user_id,
                    record.role,
                    record.created_at
                ]);
                this.sendToUI("sync:remoteUpdate", record);
            } catch (err) {
                this.sendToUI("sync:error", {message: "Failed to handle remote change", error: err});
            }
        } else if (table === 'calendar_events') {
            try {
                const sql = `
                    INSERT INTO calendar_events (id, user_id, calendar_id, start, end, summary, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO
                    UPDATE SET
                        id=excluded.id,
                        user_id=excluded.user_id,
                        calendar_id=excluded.calendar_id,
                        start=excluded.start,
                        end=excluded.end,
                        summary=excluded.summary,
                        updated_at=excluded.updated_at
                `;
                this.dbService.query(sql, [
                    record.id,
                    record.user_id,
                    record.calendar_id,
                    record.start,
                    record.end,
                    record.summary,
                    record.updated_at
                ]);
                this.sendToUI("sync:remoteUpdate", record);
            } catch (err) {
                this.sendToUI("sync:error", {message: "Failed to handle remote change", error: err});
            }
        } else if (table === 'events') {
            try {
                const sql = `
                    INSERT INTO events (id, actor, action, object_type, object_id, payload, created_at, raw)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO
                    UPDATE SET
                        id=excluded.id,
                        actor=excluded.actor,
                        action=excluded.action,
                        object_type=excluded.object_type,
                        object_id=excluded.object_id,
                        payload=excluded.payload,
                        created_at=excluded.created_at,
                        raw=excluded.raw
                `;
                this.dbService.query(sql, [
                    record.id,
                    record.actor,
                    record.action,
                    record.object_type,
                    record.object_id,
                    record.payload,
                    record.created_at,
                    record.raw
                ]);
                this.sendToUI("sync:remoteUpdate", record);
            } catch (err) {
                this.sendToUI("sync:error", {message: "Failed to handle remote change", error: err});
            }
        } else if (table === 'attachments') {
            try {
                const sql = `
                    INSERT INTO attachments (id, taskId, filename, mimetype, size, supabase_path, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO
                    UPDATE SET
                        id=excluded.id,
                        taskId=excluded.taskId,
                        filename=excluded.filename,
                        mimetype=excluded.mimetype,
                        size=excluded.size,
                        supabase_path=excluded.supabase_path,
                        created_at=excluded.created_at
                `;
                this.dbService.query(sql, [
                    record.id,
                    record.taskId,
                    record.filename,
                    record.mimetype,
                    record.size,
                    record.supabase_path,
                    record.created_at
                ]);
                this.sendToUI("sync:remoteUpdate", record);
            } catch (err) {
                this.sendToUI("sync:error", {message: "Failed to handle remote change", error: err});
            }
        }
    }

    /** 📡 Subscribe to realtime task changes */
    async startRealtimeSub() {
        const channels = ["tasks", "revisions", "projects", "teams", "attachments", "events", "users", "team_members", "calendar_events"];

        for (const channel of channels) {
            try {
                const ch = this.client
                    .channel("public:" + channel)
                    // postgres_changes still uses 3 arguments
                    .on(
                        "postgres_changes",
                        {event: "*", schema: "public", table: channel},
                        (payload) => this.handleRemoteChange(channel, payload)
                    )
                // event listeners only take 2 arguments now
                // .on("error", (e: any) => console.warn("[Sync] realtime channel error:", e))
                // .on("close", () => console.debug("[Sync] realtime channel closed"));

                await ch.subscribe((status) => {
                    if (status === "SUBSCRIBED") {
                        this.sendToUI("sync:success", {message: "Realtime subscription active for " + channel});
                        this.sendToUI("sync:status", {realtime: "connected"});
                    }
                });

                this.channels.push(ch);
            } catch (err) {
                this.sendToUI("sync:error", {message: "Failed to start realtime subscription", error: err});
                this.sendToUI("sync:status", {realtime: "error", message: String(err)});
            }
        }
    }

    /** Pull new/updated records from Supabase */
    async pullRemoteUpdates(tabel: string) {
        if (tabel === 'tasks') {
            try {
                const {
                    data,
                    error
                } = await this.client.from("tasks").select("*").order("updated_at", {ascending: true});
                if (error) throw error;
                if (!Array.isArray(data)) return;

                for (const record of data) {
                    const local = this.dbService.db.prepare("SELECT * FROM tasks WHERE id = ?").get(record.id);
                    if (!local || new Date(record.updated_at).getTime() > new Date(local.updated_at).getTime()) {
                        this.dbService.db
                            .prepare(
                                `INSERT INTO tasks (id, project_id, title, description, status, assignee, updated_at, created_at, due_date, priority)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO
                                UPDATE SET
                                    project_id=excluded.project_id,
                                    title=excluded.title,
                                    description=excluded.description,
                                    status=excluded.status,
                                    assignee=excluded.assignee,
                                    updated_at=excluded.updated_at,
                                    created_at=excluded.created_at,
                                    due_date=excluded.due_date,
                                    priority=excluded.priority`
                            )
                            .run(record.id, record.project_id, record.title, record.description, record.status, record.assignee, record.updated_at, record.created_at, record.due_date, record.priority);
                    }
                }

                this.sendToUI("sync:pull", {count: data.length});
                this.sendToUI("sync:success", {message: "Pulled " + data.length + " records"});
            } catch (err) {
                this.sendToUI("sync:error", {message: "Failed to pull records", error: err});
            }
        } else if (tabel === 'revisions') {
            try {
                const {
                    data,
                    error
                } = await this.client.from("revisions").select("*").order("created_at", {ascending: true});
                if (error) throw error;
                if (!Array.isArray(data)) return;

                for (const record of data) {
                    const local = this.dbService.db.prepare("SELECT * FROM revisions WHERE id = ?").get(record.id);
                    if (!local || new Date(record.created_at).getTime() > new Date(local.created_at).getTime()) {
                        this.dbService.db
                            .prepare(
                                `INSERT INTO revisions (id, object_type, object_id, origin_id, seq, payload, created_at,
                                                        synced)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO
                                UPDATE SET
                                    object_type=excluded.object_type,
                                    object_id=excluded.object_id,
                                    origin_id=excluded.origin_id,
                                    seq=excluded.seq,
                                    payload=excluded.payload,
                                    created_at=excluded.created_at,
                                    synced=excluded.synced`
                            )
                            .run(record.id, record.object_type, record.object_id, record.origin_id, record.seq, record.payload, record.created_at, record.synced);
                    }
                }

                this.sendToUI("sync:pull", {count: data.length});
                this.sendToUI("sync:success", {message: "Pulled " + data.length + " revisions"});
            } catch (err) {
                this.sendToUI("sync:error", {message: "Failed to pull revisions", error: err});
            }
        } else if (tabel === 'projects') {
            try {
                const {
                    data,
                    error
                } = await this.client.from("projects").select("*").order("updated_at", {ascending: true});
                if (error) throw error;
                if (!Array.isArray(data)) return;

                for (const record of data) {
                    const local = this.dbService.db.prepare("SELECT * FROM projects WHERE id = ?").get(record.id);
                    if (!local || new Date(record.updated_at).getTime() > new Date(local.updated_at).getTime()) {
                        this.dbService.db
                            .prepare(
                                `INSERT INTO projects (id, name, description, owner_id, created_at, updated_at, team_id)
                                 VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO
                                UPDATE SET
                                    name=excluded.name,
                                    description=excluded.description,
                                    owner_id=excluded.owner_id,
                                    created_at=excluded.created_at,
                                    updated_at=excluded.updated_at,
                                    team_id=excluded.team_id`
                            )
                            .run(record.id, record.name, record.description, record.owner_id, record.created_at, record.updated_at, record.team_id);
                    }
                }

                this.sendToUI("sync:pull", {count: data.length});
                this.sendToUI("sync:success", {message: "Pulled " + data.length + " projects"});
            } catch (err) {
                this.sendToUI("sync:error", {message: "Failed to pull projects", error: err});
            }
        } else if (tabel === 'teams') {
            try {
                const {
                    data,
                    error
                } = await this.client.from("teams").select("*").order("updated_at", {ascending: true});
                if (error) throw error;
                if (!Array.isArray(data)) return;

                for (const record of data) {
                    const local = this.dbService.db.prepare("SELECT * FROM teams WHERE id = ?").get(record.id);
                    if (!local || new Date(record.updated_at).getTime() > new Date(local.updated_at).getTime()) {
                        this.dbService.db
                            .prepare(
                                `INSERT INTO teams (id, project_id, name, description, created_at, updated_at)
                                 VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO
                                UPDATE SET
                                    project_id=excluded.project_id,
                                    name =excluded.name,
                                    description=excluded.description,
                                    created_at=excluded.created_at,
                                    updated_at=excluded.updated_at`
                            )
                            .run(record.id, record.project_id, record.name, record.description, record.created_at, record.updated_at);
                    }
                }

                this.sendToUI("sync:pull", {count: data.length});
                this.sendToUI("sync:success", {message: "Pulled " + data.length + " teams"});
            } catch (err) {
                this.sendToUI("sync:error", {message: "Failed to pull teams", error: err});
            }
        } else if (tabel === 'attachments') {
            try {
                const {
                    data,
                    error
                } = await this.client.from("attachments").select("*").order("created_at", {ascending: true});
                if (error) throw error;
                if (!Array.isArray(data)) return;

                for (const record of data) {
                    const local = this.dbService.db.prepare("SELECT * FROM attachments WHERE id = ?").get(record.id);
                    if (!local || new Date(record.created_at).getTime() > new Date(local.created_at).getTime()) {
                        this.dbService.db
                            .prepare(
                                `INSERT INTO attachments (id, uploaded_by, taskId, filename, mimetype, size, supabase_path,
                                                          created_at)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO
                                UPDATE SET
                                    taskId=excluded.taskId,
                                    uploaded_by=excluded.uploaded_by,
                                    filename=excluded.filename,
                                    mimetype=excluded.mimetype,
                                    size=excluded.size,
                                    supabase_path=excluded.supabase_path,
                                    created_at=excluded.created_at`
                            )
                            .run(record.id, record.taskId, record.uploaded_by, record.filename, record.mimetype, record.size, record.supabase_path, record.created_at);
                    }
                }

                this.sendToUI("sync:pull", {count: data.length});
                this.sendToUI("sync:success", {message: "Pulled " + data.length + " attachments"});
            } catch (err) {
                this.sendToUI("sync:error", {message: "Failed to pull attachments", error: err});
            }
        } else if (tabel === 'events') {
            try {
                const {
                    data,
                    error
                } = await this.client.from("events").select("*").order("created_at", {ascending: true});
                if (error) throw error;
                if (!Array.isArray(data)) return;

                for (const record of data) {
                    const local = this.dbService.db.prepare("SELECT * FROM events WHERE id = ?").get(record.id);
                    if (!local || new Date(record.created_at).getTime() > new Date(local.created_at).getTime()) {
                        this.dbService.db
                            .prepare(
                                `INSERT INTO events (id, actor, action, object_type, object_id, payload, created_at)
                                 VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO
                                UPDATE SET
                                    actor=excluded.actor,
                                    action=excluded.action,
                                    object_type=excluded.object_type,
                                    object_id=excluded.object_id,
                                    payload=excluded.payload,
                                    created_at=excluded.created_at`
                            )
                            .run(record.id, record.actor, record.action, record.object_type, record.object_id, record.payload, record.created_at);
                    }
                }

                this.sendToUI("sync:pull", {count: data.length});
                this.sendToUI("sync:success", {message: "Pulled " + data.length + " events"});
            } catch (err) {
                this.sendToUI("sync:error", {message: "Failed to pull events", error: err});
            }
        } else if (tabel === 'users') {
            try {
                const {
                    data,
                    error
                } = await this.client.from("users").select("*").order("updated_at", {ascending: true});
                if (error) throw error;
                if (!Array.isArray(data)) return;

                for (const record of data) {
                    const local = this.dbService.db.prepare("SELECT * FROM users WHERE id = ?").get(record.id);
                    if (!local || new Date(record.updated_at).getTime() > new Date(local.updated_at).getTime()) {
                        this.dbService.db
                            .prepare(
                                `INSERT INTO users (id, email, full_name, role, avatar_url, timezone, calendar_sync_enabled, google_calendar_id, available_times, updated_at, invited_at, google_refresh_token, last_calendar_sync, weekly_capacity_hours)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO
                                UPDATE SET
                                    email=excluded.email,
                                    full_name=excluded.full_name,
                                    role=excluded.role,
                                    avatar_url=excluded.avatar_url,
                                    timezone=excluded.timezone,
                                    calendar_sync_enabled=excluded.calendar_sync_enabled,
                                    google_calendar_id=excluded.google_calendar_id,
                                    available_times=excluded.available_times,
                                    updated_at=excluded.updated_at,
                                    invited_at=excluded.invited_at,
                                    google_refresh_token=excluded.google_refresh_token,
                                    last_calendar_sync=excluded.last_calendar_sync
                                    weekly_capacity_hours=excluded.weekly_capacity_hours`
                            )
                            .run(record.id, record.email, record.full_name, record.role, record.avatar_url, record.timezone, record.calendar_sync_enabled, record.google_calendar_id, record.available_times, record.updated_at, record.invited_at, record.google_refresh_token, record.last_calendar_sync, record.weekly_capacity_hours);
                    }
                }

                this.sendToUI("sync:pull", {count: data.length});
                this.sendToUI("sync:success", {message: "Pulled " + data.length + " users"});
            } catch (err) {
                this.sendToUI("sync:error", {message: "Failed to pull users", error: err});
            }
        } else if (tabel === 'team_members') {
            try {
                const {
                    data,
                    error
                } = await this.client.from("team_members").select("*").order("created_at", {ascending: true});
                if (error) throw error;
                if (!Array.isArray(data)) return;

                for (const record of data) {
                    const local = this.dbService.db.prepare("SELECT * FROM team_members WHERE id = ?").get(record.id);
                    if (!local || new Date(record.created_at).getTime() > new Date(local.created_at).getTime()) {
                        this.dbService.db
                            .prepare(
                                `INSERT INTO team_members (id, team_id, user_id, role, created_at)
                                 VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO
                                UPDATE SET
                                    team_id=excluded.team_id,
                                    user_id=excluded.user_id,
                                    role=excluded.role,
                                    created_at=excluded.created_at`
                            )
                            .run(record.id, record.team_id, record.user_id, record.role, record.created_at);
                    }
                }

                this.sendToUI("sync:pull", {count: data.length});
                this.sendToUI("sync:success", {message: "Pulled " + data.length + " team members"});
            } catch (err) {
                this.sendToUI("sync:error", {message: "Failed to pull team members", error: err});
            }
        } else if (tabel === 'calendar_events') {
            try {
                const {
                    data,
                    error
                } = await this.client.from("calendar_events").select("*").order("updated_at", {ascending: true});
                if (error) throw error;
                if (!Array.isArray(data)) return;

                for (const record of data) {
                    const local = this.dbService.db.prepare("SELECT * FROM calendar_events WHERE id = ?").get(record.id);
                    if (!local || new Date(record.updated_at).getTime() > new Date(local.updated_at).getTime()) {
                        this.dbService.db
                            .prepare(
                                `INSERT INTO calendar_events (id, user_id, calendar_id, start, end, summary, updated_at, raw)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO
                                UPDATE SET
                                    user_id=excluded.user_id,
                                    calendar_id=excluded.calendar_id,
                                    start=excluded.start,
                                    end=excluded.end,
                                    summary=excluded.summary,
                                    updated_at=excluded.updated_at,
                                    raw=excluded.raw`
                            )
                            .run(record.id, record.user_id, record.calendar_id, record.start, record.end, record.summary, record.updated_at, record.raw);
                    }
                }

                this.sendToUI("sync:pull", {count: data.length});
                this.sendToUI("sync:success", {message: "Pulled " + data.length + " calendar events"});
            } catch (err) {
                console.log(err)
                this.sendToUI("sync:error", {message: "Failed to pull calendar events", error: err});
            }
        } else if (tabel === 'time_entries') {
            try {
                const {
                    data,
                    error
                } = await this.client.from("time_entries").select("*").order("created_at", {ascending: true});
                if (error) throw error;
                if (!Array.isArray(data)) return;

                for (const record of data) {
                    const local = this.dbService.db.prepare("SELECT * FROM time_entries WHERE id = ?").get(record.id);
                    if (!local || new Date(record.created_at).getTime() > new Date(local.created_at).getTime()) {
                        this.dbService.db
                            .prepare(
                                `INSERT INTO time_entries (id, user_id, project_id, task_id, start_ts, duration_minutes, created_at)
                                 VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO
                                UPDATE SET
                                    user_id=excluded.user_id,
                                    project_id=excluded.project_id,
                                    task_id=excluded.task_id,
                                    start_ts=excluded.start_ts,
                                    duration_minutes=excluded.duration_minutes,
                                    created_at=excluded.created_at`
                            )
                            .run(record.id, record.user_id, record.project_id, record.task_id, record.start_ts, record.duration_minutes, record.created_at);
                    }
                }

                this.sendToUI("sync:pull", {count: data.length});
                this.sendToUI("sync:success", {message: "Pulled " + data.length + " time entries"});
            } catch (err) {
                this.sendToUI("sync:error", {message: "Failed to pull time entries", error: err});
            }
        } else if (tabel === 'heartbeats') {
            const userId = store.get('currentUserId');
            if (!userId) return;
            try {
                const {
                    data,
                    error
                } = await this.client.from("heartbeats").select("*").order("timestamp", {ascending: true});
                if (error) throw error;
                if (!Array.isArray(data)) return;

                for (const record of data) {
                    const local = this.dbService.db.prepare("SELECT * FROM heartbeats WHERE id = ? AND user_id = ?").get(record.id, userId);
                    if (!local || new Date(record.timestamp).getTime() > new Date(local.timestamp).getTime()) {
                        this.dbService.db
                            .prepare(
                                `INSERT INTO heartbeats (id, user_id, timestamp, duration_ms, source, platform, app, title, metadata, team_id, last_seen)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO
                                UPDATE SET
                                    user_id=excluded.user_id,
                                    timestamp=excluded.timestamp,
                                    duration_ms=excluded.duration_ms,
                                    source=excluded.source,
                                    platform=excluded.platform,
                                    app=excluded.app,
                                    title=excluded.title,
                                    metadata=excluded.metadata,
                                    team_id=excluded.team_id,
                                    last_seen=excluded.last_seen`
                            )
                            .run(record.id, record.user_id, record.timestamp, record.duration_ms, record.source, record.platform, record.app, record.title, record.metadata, record.team_id, record.last_seen);
                    }
                }

                this.sendToUI("sync:pull", {count: data.length});
                this.sendToUI("sync:success", {message: "Pulled " + data.length + " heartbeats"});
            } catch (err) {
                this.sendToUI("sync:error", {message: "Failed to pull heartbeats", error: err});
            }
        }
    }

    async pullAllRemoteUpdates() {
        const channels = ["tasks", "projects", "teams", "revisions", "attachments", "events", "users", "team_members", "calendar_events", "time_entries", "heartbeats"];
        for (const channel of channels) {
            await this.pullRemoteUpdates(channel);
        }
    }

    /** Push local revisions with retry queue */
    async pushLocalRevisions() {
        try {
            const rows = this.dbService.query("SELECT * FROM revisions WHERE synced = 0 LIMIT 50");
            if (!rows || rows.length === 0) return;

            // Define which object types are considered "background/system"
            const silentTypes = new Set([
                'heartbeats',
                'calendar_events',
                'time_entries',
                'events'
            ]);

            // Separate into user vs system revisions
            const userRows = rows.filter(r => !silentTypes.has(r.object_type));
            const backgroundRows = rows.filter(r => silentTypes.has(r.object_type));

            if (userRows.length)
                this.sendToUI("sync:info", { message: `Pushing ${userRows.length} user revisions...` });

            let backgroundCount = 0;

            for (const r of rows) {
                try {
                    const payload = JSON.parse(r.payload);
                    const { error } = await this.client.from(r.object_type).upsert(payload, { onConflict: "id" });

                    if (!error) {
                        this.dbService.query("UPDATE revisions SET synced = 1 WHERE id = ?", [r.id]);
                        if (!silentTypes.has(r.object_type)) {
                            this.sendToUI("sync:success", { message: `Synced ${r.object_type} revision: ${r.id}` });
                        } else {
                            backgroundCount++;
                        }
                    } else {
                        if (!silentTypes.has(r.object_type)) {
                            this.sendToUI("sync:warning", { message: `Failed to sync ${r.object_type} revision: ${r.id}` });
                        }
                        this.queueRetry(r);
                    }
                } catch (err) {
                    if (!silentTypes.has(r.object_type)) {
                        this.sendToUI("sync:error", { message: `Failed to sync ${r.object_type} revision: ${r.id}`, error: err });
                    }
                    this.queueRetry(r);
                }
            }

            // Summarized feedback for background revisions
            if (backgroundCount > 0) {
                this.sendToUI("sync:summary", {
                    message: `Synced ${backgroundCount} background revisions (${Array.from(silentTypes).join(', ')})`
                });
            }

        } catch (err) {
            this.sendToUI("sync:error", { message: "Failed to push local revisions", error: err });
        }
    }

    /** Retry mechanism with exponential backoff */
    private queueRetry(rev: any) {
        const retryCount = rev.retryCount || 0;
        const delay = Math.min(60000, Math.pow(2, retryCount) * 1000);

        this.sendToUI("sync:info", {message: "Queuing retry for " + rev.id + " (in " + delay + " ms)"});

        setTimeout(async () => {
            try {
                const payload = JSON.parse(rev.payload);
                const {error} = await this.client.from(rev.object_type).upsert(payload, {onConflict: "id"});

                if (!error) {
                    this.dbService.query("UPDATE revisions SET synced = 1 WHERE id = ?", [rev.id]);
                    this.sendToUI("sync:success", {message: "Synced revision: " + rev.id});
                    return;
                }
                throw error;
            } catch (err) {
                this.sendToUI("sync:error", {message: "Failed to sync revision: " + rev.id, error: err});
                // schedule again
                this.queueRetry({...rev, retryCount: retryCount + 1});
            }
        }, delay);
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
        if (error) this.sendToUI("sync:error", {message: "Failed to upload attachment", error});

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
        this.sendToUI("sync:success", {message: "Created attachment: " + newAttachment.id});
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
        const { data, error } = await this.client.storage.from("attachments").download(supabasePath);
        if (error) throw error;

        const filename = path.basename(supabasePath);
        const { canceled, filePath } = await dialog.showSaveDialog({
            defaultPath: path.join(app.getPath("downloads"), filename),
            title: "Save Attachment",
        });

        if (canceled || !filePath) return null;

        fs.writeFileSync(filePath, Buffer.from(await data.arrayBuffer()));
        this.sendToUI("sync:success", {message: "Downloaded attachment: " + filename});
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

    private sendToUI(event: string, payload: any) {
        try {
            if (!this.mainWindow || this.mainWindow.isDestroyed()) {
                console.warn(`Cannot send ${event}: mainWindow is not available.`);
                return;
            }

            // Ensure payload is serializable (IPC requires it)
            this.mainWindow.webContents.send(event, payload);
        } catch (err) {
            // Log to console or a file — DO NOT re-send to UI
            console.error(`Failed to send event '${event}' to UI:`, err);
        }
    }
}
