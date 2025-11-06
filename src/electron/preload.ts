import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
    onDeepLink: (callback: (url: string) => void) => ipcRenderer.on('deep-link', (_, url) => callback(url)),
    auth: {
        setUserId: (userId: string) => ipcRenderer.invoke('auth:set-user-id', userId),
        signInEmail: (email: string) => ipcRenderer.invoke('auth:signInEmail', email),
        signInGoogle: () => ipcRenderer.invoke('auth:signInGoogle'),
        handleCallback: (url: string) => ipcRenderer.invoke('auth:handleCallback', url),
        restoreSession: () => ipcRenderer.invoke('auth:restoreSession'),
        inviteUser: (payload: any) => ipcRenderer.invoke('auth:inviteUser', payload),
        listUsers: () => ipcRenderer.invoke('auth:listUsers'),
        listLocalUsers: () => ipcRenderer.invoke('auth:listLocalUsers'),
        getUser: (userId?: string) => ipcRenderer.invoke('auth:getUser', userId),
        updateUserRole: (payload: any) => ipcRenderer.invoke('auth:updateUserRole', payload),
        removeUser: (payload: any) => ipcRenderer.invoke('auth:removeUser', payload),
        signOut: () => ipcRenderer.invoke('auth:signOut'),
        updatePassword: (password: string) => ipcRenderer.invoke('auth:updatePassword', password),
        updateProfile: (profile: any) => ipcRenderer.invoke('db:updateProfile', profile),
    },
    calendarAPI: {
        connect: (userId?: string) => ipcRenderer.invoke('google-calendar:connect', userId),
        disconnect: (userId?: string) => ipcRenderer.invoke('google-calendar:disconnect', userId),
        getStatus: (userId?: string) => ipcRenderer.invoke('google-calendar:get-status', userId),
        getEvents: (payload: any) => ipcRenderer.invoke('google-calendar:get-events', payload),
        syncCalendar: (userId?: string) => ipcRenderer.invoke('google-calendar:sync', userId),
        createEvent: (payload: any) => ipcRenderer.invoke('google-calendar:create-event', payload),
        deleteEvent: (payload: any) => ipcRenderer.invoke('google-calendar:delete-event', payload),
    },
    metrics: {
        getMyWork: (userId: string) => ipcRenderer.invoke('metrics:getMyWork', userId),
        getTeamPulse: (teamId: string) => ipcRenderer.invoke('metrics:getTeamPulse', teamId),
        getActivityTimeline: (limit?: number) => ipcRenderer.invoke('metrics:getActivityTimeline', limit),
        getActivityTimeByUser: (userId?: string, limit?: number) => ipcRenderer.invoke('metrics:getActivityByUser', userId, limit),
        getProjectHeatmap: (days?: number) => ipcRenderer.invoke('metrics:getProjectHeatmap', days),
    },
    admin: {
        orgSummary() { return ipcRenderer.invoke('analytics:getOrgSummary') },
        taskThroughPut() { return ipcRenderer.invoke('analytics:getTaskThroughput') },
        topPerformance() { return ipcRenderer.invoke('analytics:getTopPerformers') },
        teamUtilization() { return ipcRenderer.invoke('analytics:getTeamUtilization') },
        projectLoad() { return ipcRenderer.invoke('analytics:getProjectLoad') },
        focusHeatmap() { return ipcRenderer.invoke('analytics:getFocusHeatmap') },
        userActivityHeatMap(userId?: string, days?: number, perUserGrid?: boolean) { return ipcRenderer.invoke('analytics:getUserActivityHeatmap', userId, days, perUserGrid) },
        appUsage(days?: number, limit?: number, userId?: string) { return ipcRenderer.invoke('analytics:getAppUsage', days, limit, userId) },
        forceRefreshSummaries() { return ipcRenderer.invoke('analytics:forceRefreshSummaries') },
    },
    hb: {
        getHeartbeatsForUser: (userId: string|null, startDate: number, endDate: number) => ipcRenderer.invoke('get-heartbeats', userId, startDate, endDate),
        getAggregatedTimeByApp: (userId: string|null, startDate: number, endDate: number) => ipcRenderer.invoke('get-aggregated-time', userId, startDate, endDate),
        getDailyActivity: (userId: string|null, startDate: number, endDate: number) => ipcRenderer.invoke('get-daily-activity', userId, startDate, endDate),
    },
    tm: {
        createTeamMember(payload: any) { return ipcRenderer.invoke('teamMember:create', payload) },
        updateTeamMember(payload: any) { return ipcRenderer.invoke('teamMember:update', payload) },
        updateTeamMemberRole(payload: any) { return ipcRenderer.invoke('teamMember:update-role', payload) },
        deleteTeamMember(teamMemberId: string) { return ipcRenderer.invoke('teamMember:delete', teamMemberId) },
        listTeamMembers(teamId: string|null) { return ipcRenderer.invoke('teamMember:list', teamId) },
    },
    createTask: (payload: any) => ipcRenderer.invoke("task:create", payload),
    updateTask: (payload: any) => ipcRenderer.invoke("task:update", payload),
    deleteTask: (id: string) => ipcRenderer.invoke("task:delete", id),
    listTasks: (projectId?: string) => ipcRenderer.invoke("task:list", projectId),
    uploadAttachment: (payload: any) => ipcRenderer.invoke("upload-attachment", payload),
    downloadAttachment: (payload: any) => ipcRenderer.invoke("download-attachment", payload),
    openAttachment: (payload: any) => ipcRenderer.invoke("open-attachment", payload),
    listAttachments: (taskId: string) => ipcRenderer.invoke("list-attachments", taskId),
    createProject: (payload) => ipcRenderer.invoke('db:createProject', payload),
    listProjects: (projectId:string|null) => ipcRenderer.invoke('db:listProjects', projectId),
    updateProject: (payload) => ipcRenderer.invoke('db:updateProject', payload),
    deleteProject: (payload) => ipcRenderer.invoke('db:deleteProject', payload),
    createTeam: (payload) => ipcRenderer.invoke('db:createTeam', payload),
    listTeams: (projectId) => ipcRenderer.invoke('db:listTeams', projectId),
    userTeams: (userId) => ipcRenderer.invoke('db:userTeams', userId),
    deleteTeam: (teamId) => ipcRenderer.invoke('db:deleteTeam', teamId),
    getTeam: (teamId) => ipcRenderer.invoke('db:getTeam', teamId),
    updateTeam: (payload) => ipcRenderer.invoke('db:updateTeam', payload),
    pullRemoteUpdates: () => ipcRenderer.invoke('db:originPull'),
    rawQuery: (sql: string, params?: any[]) => ipcRenderer.invoke("raw:query", sql, params),
    onPullUpdate: (cb: (data: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload);
        ipcRenderer.on("sync:pull", listener);
        return () => ipcRenderer.removeListener("sync:pull", listener);
    },
    onRemoteUpdate: (cb: (data: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload);
        ipcRenderer.on("sync:remoteUpdate", listener);
        return () => ipcRenderer.removeListener("sync:remoteUpdate", listener);
    },
    onSyncStatus: (cb: (data: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload);
        ipcRenderer.on("sync:status", listener);
        return () => ipcRenderer.removeListener("sync:status", listener);
    },
    onInfoMessage: (cb: (data: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload);
        ipcRenderer.on("sync:info", listener);
        return () => ipcRenderer.removeListener("sync:info", listener);
    },
    onSuccessMessage: (cb: (data: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload);
        ipcRenderer.on("sync:success", listener);
        return () => ipcRenderer.removeListener("sync:success", listener);
    },
    onErrorMessage: (cb: (data: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload);
        ipcRenderer.on("sync:error", listener);
        return () => ipcRenderer.removeListener("sync:error", listener);
    },
    onWarningMessage: (cb: (data: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload);
        ipcRenderer.on("sync:warning", listener);
        return () => ipcRenderer.removeListener("sync:warning", listener);
    },
});
