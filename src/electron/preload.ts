import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
    createTask: (payload: any) => ipcRenderer.invoke("task:create", payload),
    updateTask: (payload: any) => ipcRenderer.invoke("task:update", payload),
    deleteTask: (id: string) => ipcRenderer.invoke("task:delete", id),
    listTasks: () => ipcRenderer.invoke("task:list"),
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
    uploadAttachment: (taskId: string) => ipcRenderer.invoke("upload-attachment", taskId),
    downloadAttachment: (path: string) => ipcRenderer.invoke("download-attachment", path),
    listAttachments: (taskId: string) => ipcRenderer.invoke("list-attachments", taskId),
});
