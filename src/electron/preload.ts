import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
    onDeepLink: (callback: (url: string) => void) => ipcRenderer.on('deep-link', (_, url) => callback(url)),
    auth: {
        signInEmail: (email: string) => ipcRenderer.invoke('auth:signInEmail', email),
        signInGoogle: () => ipcRenderer.invoke('auth:signInGoogle'),
        handleCallback: (url: string) => ipcRenderer.invoke('auth:handleCallback', url),
        restoreSession: () => ipcRenderer.invoke('auth:restoreSession'),
        inviteUser: (payload: any) => ipcRenderer.invoke('auth:inviteUser', payload),
        listUsers: () => ipcRenderer.invoke('auth:listUsers'),
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
        getProjectHeatmap: (days?: number) => ipcRenderer.invoke('metrics:getProjectHeatmap', days),
    },
    createTask: (payload: any) => ipcRenderer.invoke("task:create", payload),
    updateTask: (payload: any) => ipcRenderer.invoke("task:update", payload),
    deleteTask: (id: string) => ipcRenderer.invoke("task:delete", id),
    listTasks: (projectId?: string) => ipcRenderer.invoke("task:list", projectId),
    uploadAttachment: (taskId: string) => ipcRenderer.invoke("upload-attachment", taskId),
    downloadAttachment: (payload: any) => ipcRenderer.invoke("download-attachment", payload),
    openAttachment: (payload: any) => ipcRenderer.invoke("open-attachment", payload),
    listAttachments: (taskId: string) => ipcRenderer.invoke("list-attachments", taskId),
    createProject: (payload) => ipcRenderer.invoke('db:createProject', payload),
    listProjects: () => ipcRenderer.invoke('db:listProjects'),
    updateProject: (payload) => ipcRenderer.invoke('db:updateProject', payload),
    createTeam: (payload) => ipcRenderer.invoke('db:createTeam', payload),
    listTeams: (projectId) => ipcRenderer.invoke('db:listTeams', projectId),
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
