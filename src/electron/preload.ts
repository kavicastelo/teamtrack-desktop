import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld("electronAPI", {
    createTask: (payload: any) => ipcRenderer.invoke("task:create", payload),
    updateTask: (payload: any) => ipcRenderer.invoke("task:update", payload),
    listTasks: () => ipcRenderer.invoke("task:list"),
    rawQuery: (sql: string, params?: any[]) =>
        ipcRenderer.invoke("raw:query", sql, params),

    onRemoteUpdate: (cb: (data: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload);
        ipcRenderer.on("remote:update", listener);
        return () => ipcRenderer.removeListener("remote:update", listener);
    },
});
