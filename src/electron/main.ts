import {app, BrowserWindow, ipcMain} from "electron";
import path from "path";
import Store from "electron-store";
import "dotenv/config";
import {DatabaseService} from "../node/db/database.service.js";
import {SupabaseSyncService} from "../node/supabase-sync.service.js";
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
        mainWindow
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
    ipcMain.handle("task:list", async (_e, projectId: string|null) => {
        try {
            return dbService.listTasks(projectId);
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
    ipcMain.handle("raw:query", async (_e, sql: string, params?: any[]) => {
        try {
            return dbService.query(sql, params);
        } catch (err: any) {
            console.error("[IPC] raw:query error:", err);
            throw err;
        }
    });

    ipcMain.handle('upload-attachment', async (_, taskId: string) => {
        try {
            const attachment = await syncService.createAttachment(taskId);
            await dbService.logEvent({
                action: "attachment:create",
                object_type: "attachment",
                object_id: attachment.id,
                payload: "attachment("+attachment.filename+") uploaded to "+attachment.supabasePath,
            });
            return attachment;
        } catch (err: any) {
            console.error("[IPC] attachment:create error:", err);
            throw err;
        }
    });

// Download and open file
    ipcMain.handle('download-attachment', async (_, supabasePath: string) => {
        try {
            return await syncService.downloadAttachment(supabasePath);
        } catch (err: any) {
            console.error("[IPC] attachment:download error:", err);
            throw err;
        }
    });

// List attachments for task
    ipcMain.handle('list-attachments', async (_, taskId: string) => {
        try {
            return await syncService.listAttachments(taskId);
        } catch (err: any) {
            console.error("[IPC] attachment:list error:", err);
            throw err;
        }
    });

    ipcMain.handle("db:createProject", (_, payload) => dbService.createProject(payload));
    ipcMain.handle("db:listProjects", (_, payload) => dbService.listProjects(payload));
    ipcMain.handle("db:updateProject", (_, payload) => dbService.updateProject(payload));

    ipcMain.handle("db:createTeam", (_, payload) => dbService.createTeam(payload));
    ipcMain.handle("db:listTeams", (_, projectId) => dbService.listTeams(projectId));
    ipcMain.handle("db:updateTeam", (_, payload) => dbService.updateTeam(payload));

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
