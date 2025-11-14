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
import {ActiveWindow, ActiveWindowDetectorService} from "../../node/active-window-detector";
import {GoogleCalendarSyncService} from "../../node/google-calendar-sync.service";

import dotenv from "dotenv";
import { autoUpdater } from "electron-updater";
import fs from "fs";
import {HeartbeatSummaryJob} from "../../node/db/aggregators/heartbeat-summary-job";

const envPath = app.isPackaged
    ? path.join(process.resourcesPath, "app.asar.unpacked", ".env")
    : path.join(process.cwd(), ".env");
dotenv.config({ path: envPath });

const store = new Store();

let dbService: DatabaseService;
let syncService: SupabaseSyncService;
let authService: AuthService;
let heartbeatService: HeartbeatService;
let idleMonitor: IdleMonitorService;
let activeWindowDetector: ActiveWindowDetectorService;
let localCollector: LocalCollectorServer;
let calendarSync: GoogleCalendarSyncService;
let hbJob: HeartbeatSummaryJob;

let mainWin: BrowserWindow | null = null;

// Desktop activity aggregation state
let currentSession: { startTime: number; win: ActiveWindow; key: string } | null = null;
let flushInterval: NodeJS.Timeout | null = null;

const logFile = path.join(app.getPath("userData"), "startup.log");

export async function initializeAppServices(mainWindow: BrowserWindow) {
    mainWin = mainWindow;
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

    calendarSync = new GoogleCalendarSyncService(dbService, authService);

    await calendarSync.start();

    heartbeatService = new HeartbeatService(authService, dbService);
    idleMonitor = new IdleMonitorService(120, 5000);
    activeWindowDetector = new ActiveWindowDetectorService(2000);
    localCollector = new LocalCollectorServer(47845, authService);

    await syncService.start();

    // Start monitors
    localCollector.start();
    heartbeatService.start();
    activeWindowDetector.start();
    idleMonitor.start();

    // Wire up heartbeat sources
    attachHeartbeatListeners();

    hbJob = new HeartbeatSummaryJob(dbService, 5 * 60 * 1000);
    hbJob.start();

    console.log("[Main] Services initialized.");

    return { dbService, syncService, authService, heartbeatService, calendarSync, hbJob };
}

export async function checkForUpdates() {
    await autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on("checking-for-update", () => fs.writeFileSync(logFile, "Checking for updates...\n"));
    autoUpdater.on("update-available", info => {
        sendToUI('sync:info', {message: "Update available: " + info.version});
        fs.writeFileSync(logFile, "Update available: " + info.version + "\n")
    });
    autoUpdater.on("update-not-available", () => fs.writeFileSync(logFile, "No update available."));
    autoUpdater.on("error", err => {
        sendToUI('sync:error', {message: "Update error: " + err});
        fs.writeFileSync(logFile, "Update error: " + err + "\n")
    });
    autoUpdater.on("update-downloaded", () => {
        sendToUI('sync:info', {message: "Update downloaded. Installing on quit..."});
        fs.writeFileSync(logFile, "Update downloaded. Installing on quit...");
    });
}

export async function shutdownServices() {
    console.log("[Main] Shutting down services...");
    try {
        // Flush final desktop session
        if (currentSession) {
            const now = Date.now();
            const duration = now - currentSession.startTime;
            if (duration > 0) {
                const payload = createDesktopPayload(currentSession.win, currentSession.startTime, duration, now);
                heartbeatService.recordHeartbeat(payload);
            }
            currentSession = null;
        }

        if (flushInterval) clearInterval(flushInterval);
        await heartbeatService.stop();
        await localCollector.stop();
        await idleMonitor.stop();
        await activeWindowDetector.stop();
        await syncService?.stop();
        await dbService?.close();
        await calendarSync?.stop();
        await hbJob?.stop();
    } catch (err) {
        console.error("[Main] Shutdown error:", err);
    }
}

function attachHeartbeatListeners() {
    // Listen for extension/plugin heartbeats
    localCollector.on('extension-heartbeat', (hb: any) => {
        heartbeatService.recordHeartbeat(hb);
    });

    // Desktop activity handler (active windows)
    activeWindowDetector.on('active-window', (win: ActiveWindow) => {
        if (idleMonitor.getIdleState()) return;  // Skip if idle

        const key = `${win.owner.name || ''}::${win.title || ''}`;

        const now = Date.now();
        if (currentSession && key !== currentSession.key) {
            // Flush old session on change
            const duration = now - currentSession.startTime;
            if (duration > 0) {
                const payload = createDesktopPayload(currentSession.win, currentSession.startTime, duration, now);
                heartbeatService.recordHeartbeat(payload);
            }
            // Start new
            currentSession = { startTime: now, win, key };
        } else if (!currentSession) {
            // Start first session
            currentSession = { startTime: now, win, key };
        }
    });

    // Idle handlers
    idleMonitor.on('idle-start', ({ since, idleSeconds }: { since: number; idleSeconds: number }) => {
        const now = Date.now();
        const idleStart = now - idleSeconds * 1000;
        if (currentSession) {
            const duration = idleStart - currentSession.startTime;
            if (duration > 0) {
                const payload = createDesktopPayload(currentSession.win, currentSession.startTime, duration, idleStart);
                heartbeatService.recordHeartbeat(payload);
            }
            currentSession = null;
        }
    });

    idleMonitor.on("idle-end", async () => {
        await heartbeatService.recordHeartbeat({
            timestamp: Date.now(),
            source: "system",
            platform: "active",
        });
    });

    // Periodic flush for long sessions (every 60s)
    flushInterval = setInterval(() => {
        if (currentSession && !idleMonitor.getIdleState()) {
            const now = Date.now();
            const duration = now - currentSession.startTime;
            if (duration > 0) {
                const payload = createDesktopPayload(currentSession.win, currentSession.startTime, duration, now);
                heartbeatService.recordHeartbeat(payload);
            }
            currentSession.startTime = now;  // Continue session
        }
    }, 60000);

    // Return services for IPC handlers
    return { dbService, authService, localCollector, heartbeatService, idleMonitor, activeWindowDetector /* others */ };
}

function createDesktopPayload(win: ActiveWindow, startTime: number, duration: number, lastSeen: number) {
    const userId: any = store.get('currentUserId');
    return {
        user_id: userId,
        timestamp: startTime,
        duration_ms: duration,
        source: 'desktop',
        platform: win.platform,
        app: win.owner.name,
        title: win.title,
        metadata: {
            path: win.owner.path,
            processId: win.owner.processId
        },
        team_id: dbService.getCurrentTeam(userId) || dbService.teamIds(userId)[0] || null,
        last_seen: lastSeen
    };
}

function sendToUI(event: string, payload: any) {
    try {
        if (!mainWin || mainWin.isDestroyed()) {
            console.warn(`Cannot send ${event}: mainWindow is not available.`);
            return;
        }

        mainWin.webContents.send(event, payload);
    } catch (err) {
        console.error(`Failed to send event '${event}' to UI:`, err);
    }
}
