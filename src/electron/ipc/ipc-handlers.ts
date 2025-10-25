import { ipcMain, shell } from "electron";
import type { DatabaseService } from "../../node/db/database.service.js";
import type { SupabaseSyncService } from "../../node/supabase-sync.service.js";
import type { AuthService } from "../services/auth.service";
import type { HeartbeatService } from "../../node/heartbeat.service";
import {registerGoogleCalendarIPC} from "./google-calendar-ipc";
import {GoogleCalendarSyncService} from "../../node/google-calendar-sync.service";

export function registerIPCHandlers(services: {
    dbService: DatabaseService;
    syncService: SupabaseSyncService;
    authService: AuthService;
    heartbeatService: HeartbeatService;
    calendarSync: GoogleCalendarSyncService;
}) {
    const { dbService, syncService, authService, heartbeatService, calendarSync  } = services;

    /** Authentication */
    ipcMain.handle("auth:signInEmail", (_, email) => authService.signIn(email));
    ipcMain.handle("auth:signInGoogle", async () => {
        const url = await authService.signInWithGoogle();
        await shell.openExternal(url);
        return { url };
    });
    ipcMain.handle("auth:handleCallback", (_, url) => authService.handleCallback(url));
    ipcMain.handle("auth:restoreSession", () => authService.restoreSession());
    ipcMain.handle("auth:signOut", () => authService.signOut());

    /** Users **/
    ipcMain.handle("auth:getUser", (_, userId?: string) =>
        userId ? authService.getUserById(userId) : authService.getCurrentUser()
    );
    ipcMain.handle('auth:inviteUser', async (_, payload) => {
        return await authService.inviteUser(payload.email, payload.role, payload.teamId);
    });
    ipcMain.handle('auth:listUsers', async () => {
        return await authService.listUsers();
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

    /** Tasks */
    ipcMain.handle("task:list", (_e, projectId) => dbService.listTasks(projectId));
    ipcMain.handle("task:create", async (_e, payload) => {
        const task = dbService.createTask(payload);
        await dbService.logEvent({
            action: "task:create",
            object_type: "task",
            object_id: task.id,
            payload: task,
        });
        return task;
    });
    ipcMain.handle("task:update", async (_e, payload) => {
        const task = dbService.updateTask(payload);
        await dbService.logEvent({
            action: "task:update",
            object_type: "task",
            object_id: task.id,
            payload: task,
        });
        return task;
    });
    ipcMain.handle("task:delete", async (_e, taskId: string) => {
        const taskDeleted = dbService.deleteTask(taskId);
        await dbService.logEvent({
            action: "task:delete",
            object_type: "task",
            object_id: taskId,
            payload: "task("+taskId+") deleted",
        });
        return taskDeleted;
    });

    /** Attachments */
    ipcMain.handle("upload-attachment", async (_, taskId: string) => {
        const attachment = await syncService.createAttachment(taskId);
        await dbService.logEvent({
            action: "attachment:create",
            object_type: "attachment",
            object_id: attachment.id,
            payload: `uploaded ${attachment.filename}`,
        });
        return attachment;
    });
    ipcMain.handle('download-attachment', async (_, payload: any) => {
        const attachment = await syncService.downloadAttachment(payload.supabasePath);
        await dbService.logEvent({
            actor: payload.userId,
            action: "attachment:download",
            object_type: "attachment",
            object_id: payload.id || 'ATTACHMENT',
            payload: "user("+payload.userId+") downloaded file from "+attachment,
        });
        return attachment;
    });
    ipcMain.handle('open-attachment', async (_, payload: any) => {
        const attachment = await syncService.openAttachment(payload.supabasePath);
        await dbService.logEvent({
            actor: payload.userId,
            action: "attachment:open",
            object_type: "attachment",
            object_id: payload.id || 'ATTACHMENT',
            payload: "user("+payload.userId+") opened file from "+attachment,
        });
        return attachment;
    });
    ipcMain.handle('list-attachments', async (_, taskId: string|null) => syncService.listAttachments(taskId));

    /** Projects **/
    ipcMain.handle("db:createProject", async (_, payload) => {
        const project = dbService.createProject(payload);
        await dbService.logEvent({
            action: "project:create",
            object_type: "project",
            object_id: project.id,
            payload: project,
        });
        return project;
    });
    ipcMain.handle("db:listProjects", async (_, payload) => dbService.listProjects(payload));
    ipcMain.handle("db:updateProject", async (_, payload) => {
        const project = dbService.updateProject(payload);
        await dbService.logEvent({
            action: "project:update",
            object_type: "project",
            object_id: project.id,
            payload: project,
        });
        return project;
    });

    /** Teams **/
    ipcMain.handle("db:createTeam", async (_, payload) => {
        const team = dbService.createTeam(payload);
        await dbService.logEvent({
            action: "team:create",
            object_type: "team",
            object_id: team.id,
            payload: team,
        });
        return team;
    });
    ipcMain.handle("db:listTeams", async (_, projectId) => dbService.listTeams(projectId));
    ipcMain.handle("db:updateTeam", async (_, payload) => {
        const team = dbService.updateTeam(payload);
        await dbService.logEvent({
            action: "team:update",
            object_type: "team",
            object_id: team.id,
            payload: team,
        });
        return team;
    });

    /** Raw query passthrough **/
    ipcMain.handle("raw:query", async (_e, sql: string, params?: any[]) => dbService.query(sql, params));

    /** Sync **/
    ipcMain.handle("db:originPull", async (_) => syncService.pullAllRemoteUpdates());

    /** Google Calendar **/
    registerGoogleCalendarIPC(authService, dbService, calendarSync);
}
