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
                action: "attachment:download",
                object_type: "attachment",
                object_id: payload.userId,
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
                action: "attachment:open",
                object_type: "attachment",
                object_id: payload.userId,
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
