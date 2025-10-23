import path from "path";
import crypto from "crypto";
import Store from "electron-store";
import {app, BrowserWindow} from "electron";

import { DatabaseService } from "../../node/db/database.service.js";
import { SupabaseSyncService } from "../../node/supabase-sync.service.js";
import { AuthService } from "./auth.service";
import { HeartbeatService } from "../../node/heartbeat.service";
import { LocalCollectorServer } from "../../node/local-collector-server";
import { IdleMonitorService } from "../../node/idle-monitor.service";
import { ActiveWindowDetectorService } from "../../node/active-window-detector";

let dbService: DatabaseService;
let syncService: SupabaseSyncService;
let authService: AuthService;
let heartbeatService: HeartbeatService;
let idleMonitor: IdleMonitorService;
let activeWindowDetector: ActiveWindowDetectorService;
let localCollector: LocalCollectorServer;

export async function initializeAppServices(mainWindow: BrowserWindow) {
    const store = new Store();
    const key =
        (store.get("dbKey") as string) ||
        (() => {
            const k = crypto.randomBytes(32).toString("hex");
            store.set("dbKey", k);
            return k;
        })();

    dbService = new DatabaseService({
        dbPath: path.join(app.getPath("userData"), "teamtrack.db.enc"),
        encryptionKey: key,
    });

    await dbService.open();

    syncService = new SupabaseSyncService({
        supabaseUrl: process.env.SUPABASE_URL!,
        supabaseKey: process.env.SUPABASE_ANON_KEY!,
        db: dbService,
        mainWindow,
    });

    authService = new AuthService({
        supabaseUrl: process.env.SUPABASE_URL!,
        supabaseKey: process.env.SUPABASE_ANON_KEY!,
        db: dbService,
        mainWindow,
    });

    heartbeatService = new HeartbeatService(authService, dbService);
    idleMonitor = new IdleMonitorService(120, 5000);
    activeWindowDetector = new ActiveWindowDetectorService(2000);
    localCollector = new LocalCollectorServer(47845);

    await syncService.start();

    // Start monitors
    localCollector.start();
    activeWindowDetector.start();
    idleMonitor.start();

    // Wire up heartbeat sources
    attachHeartbeatListeners();

    console.log("[Main] Services initialized.");

    return { dbService, syncService, authService, heartbeatService };
}

export async function shutdownServices() {
    console.log("[Main] Shutting down services...");
    try {
        await syncService?.stop();
        await dbService?.close();
    } catch (err) {
        console.error("[Main] Shutdown error:", err);
    }
}

function attachHeartbeatListeners() {
    localCollector.on("extension-heartbeat", async (hb) => {
        await heartbeatService.recordHeartbeat({
            timestamp: hb.timestamp || Date.now(),
            source: "extension",
            platform: hb.platform || hb.app || "extension",
            app: hb.app,
            title: hb.title,
            metadata: hb.metadata || {},
            duration_ms: hb.duration_ms || undefined,
        });
    });

    activeWindowDetector.on("active-window", async (win) => {
        if (idleMonitor.getIdleState()) return;
        await heartbeatService.recordHeartbeat({
            timestamp: win.timestamp,
            source: "detector",
            platform: win.platform,
            app: win.owner?.name,
            title: win.title,
        });
    });

    idleMonitor.on("idle-start", async (info) => {
        await heartbeatService.recordHeartbeat({
            timestamp: Date.now(),
            source: "system",
            platform: "idle",
            metadata: { idleSeconds: info.idleSeconds },
        });
    });

    idleMonitor.on("idle-end", async () => {
        await heartbeatService.recordHeartbeat({
            timestamp: Date.now(),
            source: "system",
            platform: "active",
        });
    });
}
