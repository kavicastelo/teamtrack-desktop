import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    query: (q: string, params?: any[]) => ipcRenderer.invoke('db:query', q, params),
    createTask: (payload: any) => ipcRenderer.invoke('task:create', payload),
    // subscribe to notifications
    onRemoteUpdate: (cb: (event:any) => void) => {
        ipcRenderer.on('sync:remote', (e, data) => cb(data));
    }
});
