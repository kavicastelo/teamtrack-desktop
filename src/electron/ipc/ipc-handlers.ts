import { ipcMain, shell } from "electron";
import type { DatabaseService } from "../../node/db/database.service.js";
import type { SupabaseSyncService } from "../../node/supabase-sync.service.js";
import type { AuthService } from "../services/auth.service";
import type { HeartbeatService } from "../../node/heartbeat.service";
import {registerGoogleCalendarIPC} from "./google-calendar-ipc";
import {GoogleCalendarSyncService} from "../../node/google-calendar-sync.service";
import {registerMetricsIPC} from "./metrics-ipc";
import {registerHeartbeatIPC} from "./heartbeat-ips";
import {registerAdminAnalyticsIPC} from "./register-admin-analytics-ipc";
import {HeartbeatSummaryJob} from "../../node/db/aggregators/heartbeat-summary-job";
const Store = require('electron-store');
const store = new Store();

export function registerIPCHandlers(services: {
    dbService: DatabaseService;
    syncService: SupabaseSyncService;
    authService: AuthService;
    heartbeatService: HeartbeatService;
    calendarSync: GoogleCalendarSyncService;
    hbJob: HeartbeatSummaryJob;
}) {
    const { dbService, syncService, authService, heartbeatService, calendarSync, hbJob  } = services;
    const currentUserId = store.get('currentUserId');

    /** Authentication */
    ipcMain.handle("auth:signInEmail", (_, email) => authService.signIn(email));
    ipcMain.handle("auth:signInGoogle", async () => {
        const url = await authService.signInWithGoogle();
        await shell.openExternal(url);
        return { url };
    });
    ipcMain.handle("auth:handleCallback", (_, url) => authService.handleCallback(url));
    ipcMain.handle("auth:restoreSession", async () => {
        const session = await authService.restoreSession();
        await dbService.logEvent({
            actor: currentUserId,
            action: "session:restore",
            object_type: "user",
            object_id: session?.user?.id,
            payload: session,
        });
        return session;
    });
    ipcMain.handle("auth:signOut", async () => {
        await authService.signOut();
        await dbService.logEvent({
            actor: currentUserId,
            action: "session:sign_out",
            object_type: "user",
            object_id: currentUserId,
        })
    });

    /** Users **/
    ipcMain.handle('auth:set-user-id', (event, id) => {
        store.set('currentUserId', id);
    });
    ipcMain.handle("auth:getUser", (_, userId?: string) =>
        userId ? authService.getUserById(userId) : authService.getCurrentUser()
    );
    ipcMain.handle('auth:inviteUser', async (_, payload) => {
        return await authService.inviteUser(payload.email, payload.role, payload.teamId);
    });
    ipcMain.handle('auth:listUsers', async () => {
        return await authService.listUsers();
    });
    ipcMain.handle('auth:listLocalUsers', async () => {
        return dbService.listLocalUsers();
    });
    ipcMain.handle('auth:updateUserRole', async (_, payload) => {
        const user = await authService.updateUserRole(payload.userId, payload.role, payload.teamId);
        await dbService.logEvent({
            actor: currentUserId,
            action: "user:update_role",
            object_type: "user",
            object_id: 'admin',
            payload: user,
        })
        return user;
    });
    ipcMain.handle('auth:removeUser', async (_, payload) => {
        // payload: { userId, hardDelete?: boolean }
        const user = await authService.removeUser(payload.userId, payload.hardDelete);
        await dbService.logEvent({
            actor: currentUserId,
            action: "user:remove",
            object_type: "user",
            object_id: 'admin',
            payload: user,
        })
        return user;
    });
    ipcMain.handle('auth:updatePassword', async (_, password) => {
        const user = await authService.updatePassword(password)
        await dbService.logEvent({
            actor: currentUserId,
            action: "user:update_password",
            object_type: "user",
            object_id: currentUserId,
            payload: user,
        })
        return user;
    });

    ipcMain.handle('db:updateProfile', async (_, profile) => {
        const user = await authService.updateProfile(profile)
        await dbService.logEvent({
            actor: currentUserId,
            action: "user:update_profile",
            object_type: "user",
            object_id: currentUserId,
            payload: user,
        })
        return user;
    });

    /** Team Members */
    ipcMain.handle("teamMember:list", (_e, teamId) => dbService.listTeamMembers(teamId));
    ipcMain.handle("teamMember:create", async (_e, payload) => {
        const teamMember = dbService.createTeamMember(payload)
        await dbService.logEvent({
            actor: currentUserId,
            action: "team_member:create",
            object_type: "team_member",
            object_id: payload.id,
            payload: teamMember,
        })
        return teamMember;
    });
    ipcMain.handle("teamMember:update", async (_e, payload) => {
        const teamMember = dbService.updateTeamMember(payload)
        await dbService.logEvent({
            actor: currentUserId,
            action: "team_member:update",
            object_type: "team_member",
            object_id: payload.id,
            payload: teamMember,
        })
        return teamMember;
    });
    ipcMain.handle('teamMember:update-role', async (_e, payload) => {
        const teamMember = dbService.updateTeamMemberRole(payload)
        await dbService.logEvent({
            actor: currentUserId,
            action: "team_member:update_role",
            object_type: "team_member",
            object_id: payload.id,
            payload: teamMember,
        })
        return teamMember;
    });
    ipcMain.handle("teamMember:delete", async (_e, teamMemberId: string) => {
        const teamMember = dbService.deleteTeamMember(teamMemberId)
        await dbService.logEvent({
            actor: currentUserId,
            action: "team_member:delete",
            object_type: "team_member",
            object_id: teamMemberId,
            payload: teamMember,
        })
        return teamMember;
    });

    /** Tasks */
    ipcMain.handle("task:list", (_e, projectId) => dbService.listTasks(projectId));
    ipcMain.handle("task:create", async (_e, payload) => {
        const task = dbService.createTask(payload);
        await dbService.logEvent({
            actor: currentUserId,
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
            actor: currentUserId,
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
            actor: currentUserId,
            action: "task:delete",
            object_type: "task",
            object_id: taskId,
            payload: "task("+taskId+") deleted",
        });
        return taskDeleted;
    });

    /** Attachments */
    ipcMain.handle("upload-attachment", async (_, payload) => {
        const attachment = await syncService.createAttachment(payload.taskId, payload.uploaded_by);
        await dbService.logEvent({
            actor: currentUserId,
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
            actor: payload.userId || currentUserId,
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
            actor: payload.userId || currentUserId,
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
            actor: currentUserId,
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
            actor: currentUserId,
            action: "project:update",
            object_type: "project",
            object_id: project.id,
            payload: project,
        });
        return project;
    });
    ipcMain.handle("db:deleteProject", async (_, projectId: string) => {
        const projectDeleted = dbService.deleteProject(projectId);
        await dbService.logEvent({
            actor: currentUserId,
            action: "project:delete",
            object_type: "project",
            object_id: projectId,
            payload: "project("+projectId+") deleted",
        });
        return projectDeleted;
    })

    /** Teams **/
    ipcMain.handle("db:createTeam", async (_, payload) => {
        const team = dbService.createTeam(payload);
        await dbService.logEvent({
            actor: currentUserId,
            action: "team:create",
            object_type: "team",
            object_id: team.id,
            payload: team,
        });
        return team;
    });
    ipcMain.handle("db:listTeams", async (_, projectId) => dbService.listTeams(projectId));
    ipcMain.handle('db:userTeams', async (_, userId) => dbService.userTeams(userId));
    ipcMain.handle("db:getTeam", async (_, teamId) => dbService.getTeam(teamId));
    ipcMain.handle("db:updateTeam", async (_, payload) => {
        const team = dbService.updateTeam(payload);
        await dbService.logEvent({
            actor: currentUserId,
            action: "team:update",
            object_type: "team",
            object_id: team.id,
            payload: team,
        });
        return team;
    });
    ipcMain.handle("db:deleteTeam", async (_, teamId: string) => {
        const teamDeleted = dbService.deleteTeam(teamId);
        await dbService.logEvent({
            actor: currentUserId,
            action: "team:delete",
            object_type: "team",
            object_id: teamId,
            payload: "team("+teamId+") deleted",
        });
        return teamDeleted;
    });

    /** Raw query passthrough **/
    ipcMain.handle("raw:query", async (_e, sql: string, params?: any[]) => dbService.query(sql, params));

    /** Sync **/
    ipcMain.handle("db:originPull", async (_) => syncService.pullAllRemoteUpdates());

    /** Google Calendar **/
    registerGoogleCalendarIPC(authService, dbService, calendarSync);

    /** Metrics **/
    registerMetricsIPC(dbService);
    registerAdminAnalyticsIPC(dbService, hbJob);

    /** Heartbeat **/
    registerHeartbeatIPC(dbService);
}
