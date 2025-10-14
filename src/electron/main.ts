import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import Store from "electron-store";
import "dotenv/config";
import { DatabaseService } from "../node/db/database.service.js";
import { SupabaseSyncService } from "../node/supabase-sync.service.js";
import crypto from "crypto";

const store = new Store();
let mainWindow: BrowserWindow | null = null;
let dbService: DatabaseService;
let syncService: SupabaseSyncService;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 840,
        webPreferences: {
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
    await dbService.open();

    syncService = new SupabaseSyncService({
        supabaseUrl: process.env.SUPABASE_URL!,
        supabaseKey: process.env.SUPABASE_ANON_KEY!,
        db: dbService,
    });
    await syncService.start();

    /** IPC handlers */
    ipcMain.handle("db:query", async (_e, sql: string, params?: any[]) => {
        try {
            return dbService.query(sql, params);
        } catch (err: any) {
            console.error("[IPC] db:query error:", err);
            throw err;
        }
    });

// 🔹 List tasks
    ipcMain.handle("task:list", async () => {
        try {
            return dbService.listTasks();
        } catch (err: any) {
            console.error("[IPC] task:list error:", err);
            throw err;
        }
    });

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

// 🔹 Raw query passthrough
    ipcMain.handle("raw:query", async (_e, sql: string, params?: any[]) => {
        try {
            return dbService.query(sql, params);
        } catch (err: any) {
            console.error("[IPC] raw:query error:", err);
            throw err;
        }
    });

// 🔹 Forward remote realtime updates to renderer
    syncService.on("remote:applied", (_evt) => {
        if (mainWindow) mainWindow.webContents.send("remote:update", _evt);
    });

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("before-quit", async () => {
    console.log("[App] Quitting — saving data...");
    if (syncService) await syncService.stop();
    if (dbService) await dbService.close();
});
