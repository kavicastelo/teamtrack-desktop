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

    if (window.electronAPI?.onSuccessMessage) {
      window.electronAPI.onSuccessMessage((data: any) =>
        this.statusEvents$.next({type: "success", record: data}));
    }

    if (window.electronAPI?.onErrorMessage) {
      window.electronAPI.onErrorMessage((data: any) =>
        this.statusEvents$.next({type: "error", record: data}));
    }

    if (window.electronAPI?.onInfoMessage) {
      window.electronAPI.onInfoMessage((data: any) =>
        this.statusEvents$.next({type: "info", record: data}));
    }

    if (window.electronAPI?.onWarningMessage) {
      window.electronAPI.onWarningMessage((data: any) =>
        this.statusEvents$.next({type: "warning", record: data}));
    }
  }

  async createTask(payload: any) {
    return window.electronAPI.createTask(payload);
  }
  async updateTask(payload: any) {
    return window.electronAPI.updateTask(payload);
  }
  async listTasks(projectId?: string|null) {
    return window.electronAPI.listTasks(projectId);
  }
  async deleteTask(id: string) {
    return window.electronAPI.deleteTask(id);
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
  async listAttachments(taskId?: string|null) {
    return window.electronAPI.listAttachments(taskId);
  }
  async downloadAttachment(payload: any) {
    return window.electronAPI.downloadAttachment(payload);
  }
  async openAttachment(payload: any) {
    return window.electronAPI.openAttachment(payload);
  }

  async createProject(payload: any) {
    return window.electronAPI.createProject(payload);
  }
  async listProjects(projectId?: string|null) {
    return window.electronAPI.listProjects(projectId);
  }
  async updateProject(payload: any) {
    return window.electronAPI.updateProject(payload);
  }

  async createTeam(payload: any) {
    return window.electronAPI.createTeam(payload);
  }
  async listTeams(projectId?: string|null) {
    return window.electronAPI.listTeams(projectId);
  }
  async updateTeam(payload: any) {
    return window.electronAPI.updateTeam(payload);
  }

  async pullRemoteUpdates() {
    return window.electronAPI.pullRemoteUpdates();
  }
}
