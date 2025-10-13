import { Injectable } from '@angular/core';

declare global {
  interface Window {
    electronAPI: any;
  }
}

@Injectable({ providedIn: 'root' })
export class IpcService {
  async createTask(payload: any) {
    return window.electronAPI.createTask(payload);
  }
  async query(q: string, params?: any[]) {
    return window.electronAPI.query(q, params);
  }
  onRemoteUpdate(cb: (data:any) => void) {
    window.electronAPI.onRemoteUpdate(cb);
  }
}
