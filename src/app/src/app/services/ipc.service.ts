import { Injectable } from '@angular/core';
import {Subject} from 'rxjs';

declare global {
  interface Window {
    electronAPI: any;
  }
}

@Injectable({ providedIn: 'root' })
export class IpcService {
  statusEvents$ = new Subject<any>();
  syncEvents$ = new Subject<any>();

  constructor() {
    if (window.electronAPI?.onPullUpdate) {
      window.electronAPI.onPullUpdate((data: any) =>
        this.syncEvents$.next({ type: "pull", ...data })
      );
    }

    if (window.electronAPI?.onRemoteUpdate) {
      window.electronAPI.onRemoteUpdate((data: any) =>
        this.syncEvents$.next({ type: "remoteUpdate", record: data })
      );
    }

    if (window.electronAPI?.onSyncStatus) {
      window.electronAPI.onSyncStatus((data: any) => this.statusEvents$.next(data));
    }
  }

  async createTask(payload: any) {
    return window.electronAPI.createTask(payload);
  }
  async updateTask(payload: any) {
    return window.electronAPI.updateTask(payload);
  }
  async listTasks() {
    return window.electronAPI.listTasks();
  }
  async rawQuery(sql: string, params?: any[]) {
    return window.electronAPI.rawQuery(sql, params);
  }
  onRemoteUpdateFn(cb: (payload: any) => void) {
    return window.electronAPI.onRemoteUpdate(cb);
  }
  onPullUpdateFn(cb: (payload: any) => void) {
    return window.electronAPI.onPullUpdate(cb);
  }
  async uploadAttachment(taskId: string) {
    return window.electronAPI.uploadAttachment(taskId);
  }
  async listAttachments(taskId: string) {
    return window.electronAPI.listAttachments(taskId);
  }
  async downloadAttachment(supabasePath: string) {
    return window.electronAPI.downloadAttachment(supabasePath);
  }
}
