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
  async updateTask(payload: any) {
    return window.electronAPI.updateTask(payload);
  }
  async listTasks() {
    return window.electronAPI.listTasks();
  }
  async rawQuery(sql: string, params?: any[]) {
    return window.electronAPI.rawQuery(sql, params);
  }
  onRemoteUpdate(cb: (payload: any) => void) {
    return window.electronAPI.onRemoteUpdate(cb);
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
