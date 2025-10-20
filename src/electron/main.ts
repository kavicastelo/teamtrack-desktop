import {app, BrowserWindow, ipcMain, shell} from "electron";
import path from "path";
import Store from "electron-store";
import "dotenv/config";
import {DatabaseService} from "../node/db/database.service.js";
import {SupabaseSyncService} from "../node/supabase-sync.service.js";
import crypto from "crypto";
import {AuthService} from "./auth.service";
import {HeartbeatService} from "../node/heartbeat.service";
import {LocalCollectorServer} from "../node/local-collector-server";
import {IdleMonitorService} from "../node/idle-monitor.service";
import {ActiveWindowDetectorService} from "../node/active-window-detector";

const store = new Store();
let mainWindow: BrowserWindow | null = null;
let dbService: DatabaseService;
let syncService: SupabaseSyncService;
let heartbeatService: HeartbeatService;
let authService: AuthService;
const activeWindowDetector = new ActiveWindowDetectorService(2000);
const idleMonitor = new IdleMonitorService(120, 5000);
const localCollector = new LocalCollectorServer(47845);
let deepLinkUrl: string | null = null;
const gotLock = app.requestSingleInstanceLock();
const protocolName = 'myapp';

// -- macOS & Windows install handling
if (process.defaultApp) {
    // Running via `electron .` (dev mode)
    app.setAsDefaultProtocolClient(protocolName, process.execPath, [path.resolve(process.argv[1])]);
} else {
    // Packaged app
    app.setAsDefaultProtocolClient(protocolName);
}

// -- Handle deep link URLs before app ready (Windows)
if (process.platform === 'win32') {
    const deepArg = process.argv.find(arg => arg.startsWith(`${protocolName}://`));
    if (deepArg) deepLinkUrl = deepArg;
}

// start server and detectors after auth/session restored (so we know user)
localCollector.on('listening', ({ port }) => {
    console.log('[Collector] LocalCollectorServer listening on', port);
});

localCollector.on('extension-heartbeat', async (hb) => {
    // Validate/minimal shaping
    const shaped = {
        timestamp: hb.timestamp || Date.now(),
        source: 'extension',
        platform: hb.platform || hb.app || 'extension',
        app: hb.app,
        title: hb.title,
        metadata: hb.metadata || {},
        duration_ms: hb.duration_ms || undefined
    };
    await heartbeatService.recordHeartbeat(shaped);
});

activeWindowDetector.on('active-window', async (win) => {
    // If user idle, ignore
    if (idleMonitor.getIdleState()) return;
    // Compose heartbeat
    const hb = {
        timestamp: win.timestamp,
        source: 'detector',
        platform: win.platform,
        app: win.owner?.name,
        title: win.title,
    };
    await heartbeatService.recordHeartbeat(hb);
});

idleMonitor.on('idle-start', async (info) => {
    console.log('[Idle] user idle start', info);
    // Optionally record an idle_event heartbeat
    await heartbeatService.recordHeartbeat({
        timestamp: Date.now(),
        source: 'system',
        platform: 'idle',
        metadata: { idleSeconds: info.idleSeconds }
    });
});

idleMonitor.on('idle-end', async () => {
    console.log('[Idle] resumed');
    await heartbeatService.recordHeartbeat({
        timestamp: Date.now(),
        source: 'system',
        platform: 'active',
    });
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 840,
        webPreferences: {
            zoomFactor: 1.0,
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    const devUrl =
        process.env.ELECTRON_START_URL ||
        `file://${path.join(__dirname, "../../dist/browser/index.html")}`;

    mainWindow.loadURL(devUrl).catch((err) =>
        console.error("[Main] Failed to load window:", err)
    );

    mainWindow.on("closed", () => {
        mainWindow = null;
    });

    // Forward deep link once renderer ready
    mainWindow.webContents.on('did-finish-load', () => {
        if (deepLinkUrl) {
            mainWindow!.webContents.send('deep-link', deepLinkUrl);
            deepLinkUrl = null;
        }
    });
}

app.whenReady().then(async () => {
    createWindow();

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

    syncService = new SupabaseSyncService({
        supabaseUrl: process.env.SUPABASE_URL!,
        supabaseKey: process.env.SUPABASE_ANON_KEY!,
        db: dbService,
        mainWindow
    });

    authService = new AuthService({
        supabaseUrl: process.env.SUPABASE_URL!,
        supabaseKey: process.env.SUPABASE_ANON_KEY!,
        db: dbService,
        mainWindow
    });

    heartbeatService = new HeartbeatService(authService, dbService);

    await dbService.open();
    await syncService.start();

    // Register custom protocol (macOS + Windows)
    if (process.defaultApp) {
        if (process.argv.length >= 2) {
            app.setAsDefaultProtocolClient('myapp', process.execPath, [path.resolve(process.argv[1])]);
        }
    } else {
        app.setAsDefaultProtocolClient('myapp');
    }

    /** Heartbeat */
    localCollector.start();
    activeWindowDetector.start();
    idleMonitor.start();

    /** IPC handlers */
// Email sign-in
    ipcMain.handle('auth:signInEmail', async (_, email) => {
        return await authService.signIn(email);
    });

// Google login
    ipcMain.handle('auth:signInGoogle', async () => {
        const url = await authService.signInWithGoogle();
        await shell.openExternal(url);
        return { url };
    });

// OAuth callback (from redirect URL)
    ipcMain.handle('auth:handleCallback', async (_, url) => {
        return await authService.handleCallback(url);
    });

// Restore session
    ipcMain.handle('auth:restoreSession', async () => {
        return await authService.restoreSession();
    });

    ipcMain.handle('auth:inviteUser', async (_, payload) => {
        return await authService.inviteUser(payload.email, payload.role, payload.teamId);
    });

    ipcMain.handle('auth:listUsers', async () => {
        return await authService.listUsers();
    });

    ipcMain.handle('auth:getUser', async (_, userId?: string) => {
        // If called with no id, return current user (existing handler maybe), else return profile.
        if (!userId) return authService.getCurrentUser();
        return await authService.getUserById(userId);
    });

    ipcMain.handle('auth:updateUserRole', async (_, payload) => {
        return await authService.updateUserRole(payload.userId, payload.role, payload.teamId);
    });

    ipcMain.handle('auth:removeUser', async (_, payload) => {
        // payload: { userId, hardDelete?: boolean }
        return await authService.removeUser(payload.userId, payload.hardDelete);
    });

    ipcMain.handle('auth:updatePassword', async (_, password) => authService.updatePassword(password));

    ipcMain.handle('db:updateProfile', async (_, profile) => authService.updateProfile(profile));

// Sign out
    ipcMain.handle('auth:signOut', () => authService.signOut());

// 🔹 List tasks
    ipcMain.handle("task:list", async (_e, projectId: string|null) => dbService.listTasks(projectId));

// 🔹 Create task
    ipcMain.handle("task:create", async (_e, payload) => {
        try {
            const task = dbService.createTask(payload);
            await dbService.logEvent({
                action: "task:create",
                object_type: "task",
                object_id: task.id,
                payload: task,
            });
            return task;
        } catch (err: any) {
            console.error("[IPC] task:create error:", err);
            throw err;
        }
    });

// 🔹 Update task
    ipcMain.handle("task:update", async (_e, payload) => {
        try {
            const task = dbService.updateTask(payload);
            await dbService.logEvent({
                action: "task:update",
                object_type: "task",
                object_id: task.id,
                payload: task,
            });
            return task;
        } catch (err: any) {
            console.error("[IPC] task:update error:", err);
            throw err;
        }
    });

// 🔹 Delete task
    ipcMain.handle("task:delete", async (_e, taskId: string) => {
        try {
            const taskDeleted = dbService.deleteTask(taskId);
            await dbService.logEvent({
                action: "task:delete",
                object_type: "task",
                object_id: taskId,
                payload: "task("+taskId+") deleted",
            });
            return taskDeleted;
        } catch (err: any) {
            console.error("[IPC] task:delete error:", err);
            throw err;
        }
    });

// 🔹 Raw query passthrough
    ipcMain.handle("raw:query", async (_e, sql: string, params?: any[]) => dbService.query(sql, params));

    ipcMain.handle('upload-attachment', async (_, taskId: string) => {
        try {
            const attachment = await syncService.createAttachment(taskId);
            await dbService.logEvent({
                action: "attachment:create",
                object_type: "attachment",
                object_id: attachment.id,
                payload: "attachment("+attachment.filename+") uploaded to "+attachment.supabase_path,
            });
            return attachment;
        } catch (err: any) {
            console.error("[IPC] attachment:create error:", err);
            throw err;
        }
    });

// Download to device
    ipcMain.handle('download-attachment', async (_, payload: any) => {
        try {
            const attachment = await syncService.downloadAttachment(payload.supabasePath);
            await dbService.logEvent({
                actor: payload.userId,
                action: "attachment:download",
                object_type: "attachment",
                object_id: payload.id || 'ATTACHMENT',
                payload: "user("+payload.userId+") downloaded file from "+attachment,
            });
            return attachment;
        } catch (err: any) {
            console.error("[IPC] attachment:download error:", err);
            throw err;
        }
    });

    // Download and open attachment
    ipcMain.handle('open-attachment', async (_, payload: any) => {
        try {
            const attachment = await syncService.openAttachment(payload.supabasePath);
            await dbService.logEvent({
                actor: payload.userId,
                action: "attachment:open",
                object_type: "attachment",
                object_id: payload.id || 'ATTACHMENT',
                payload: "user("+payload.userId+") opened file from "+attachment,
            });
            return attachment;
        } catch (err: any) {
            console.error("[IPC] attachment:open error:", err);
            throw err;
        }
    });

// List attachments for task
    ipcMain.handle('list-attachments', async (_, taskId: string|null) => syncService.listAttachments(taskId));

    ipcMain.handle("db:createProject", async (_, payload) => {
        try {
            const project = dbService.createProject(payload);
            await dbService.logEvent({
                action: "project:create",
                object_type: "project",
                object_id: project.id,
                payload: project,
            });
            return project;
        } catch (err: any) {
            console.error("[IPC] project:create error:", err);
            throw err;
        }
    });
    ipcMain.handle("db:listProjects", async (_, payload) => dbService.listProjects(payload));
    ipcMain.handle("db:updateProject", async (_, payload) => {
        try {
            const project = dbService.updateProject(payload);
            await dbService.logEvent({
                action: "project:update",
                object_type: "project",
                object_id: project.id,
                payload: project,
            });
            return project;
        } catch (err: any) {
            console.error("[IPC] project:update error:", err);
            throw err;
        }
    });

    ipcMain.handle("db:createTeam", async (_, payload) => {
        try {
            const team = dbService.createTeam(payload);
            await dbService.logEvent({
                action: "team:create",
                object_type: "team",
                object_id: team.id,
                payload: team,
            });
            return team;
        } catch (err: any) {
            console.error("[IPC] team:create error:", err);
            throw err;
        }
    });
    ipcMain.handle("db:listTeams", async (_, projectId) => dbService.listTeams(projectId));
    ipcMain.handle("db:updateTeam", async (_, payload) => {
        try {
            const team = dbService.updateTeam(payload);
            await dbService.logEvent({
                action: "team:update",
                object_type: "team",
                object_id: team.id,
                payload: team,
            });
            return team;
        } catch (err: any) {
            console.error("[IPC] team:update error:", err);
            throw err;
        }
    });

    ipcMain.handle("db:originPull", async (_) => syncService.pullAllRemoteUpdates());

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("before-quit", async () => {
    console.log("[App] Quitting — saving data...");
    if (syncService) await syncService.stop();
    if (dbService) await dbService.close();
});

app.on('open-url', (event, url) => {
    event.preventDefault();
    console.log('Received deep link:', url);

    // Send to renderer (Angular)
    if (mainWindow) {
        mainWindow.webContents.send('deep-link', url);
    }
});

// macOS deep link event
app.on('open-url', (event, url) => {
    event.preventDefault();
    if (mainWindow) mainWindow.webContents.send('deep-link', url);
    else deepLinkUrl = url;
});

// Windows: when user opens another instance with link
if (!gotLock) app.quit();
else {
    app.on('second-instance', (_, argv) => {
        const url = argv.find(a => a.startsWith(`${protocolName}://`));
        if (url && mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            mainWindow.webContents.send('deep-link', url);
        }
    });
}
