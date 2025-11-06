import { Injectable } from '@angular/core';
import {Subject} from 'rxjs';

declare global {
  interface Window {
    electronAPI: any;
    calendarAPI: {
      connect(userId?: string|null): Promise<any>;
      disconnect(userId?: string|null): Promise<any>;
      getStatus(userId?: string|null): Promise<{ connected: boolean; calendar_id?: string; sync_enabled?: boolean }>;
      getEvents(payload?: any): Promise<any>;
      syncCalendar(userId?: string|null): Promise<any>;
      createEvent(payload: any): Promise<any>;
      deleteEvent(payload: any): Promise<any>;
    };
    admin: any;
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

  async uploadAttachment(payload: any) {
    return window.electronAPI.uploadAttachment(payload);
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
  async deleteProject(id: string) {
    return window.electronAPI.deleteProject(id);
  }

  async createTeam(payload: any) {
    return window.electronAPI.createTeam(payload);
  }
  async listTeams(projectId?: string|null) {
    return window.electronAPI.listTeams(projectId);
  }
  async userTeams(userId?: string|null) {
    return window.electronAPI.userTeams(userId);
  }
  async deleteTeam(id: string) {
    return window.electronAPI.deleteTeam(id);
  }
  async updateTeam(payload: any) {
    return window.electronAPI.updateTeam(payload);
  }
  async getTeam(id: string|null) {
    return window.electronAPI.getTeam(id);
  }

  async pullRemoteUpdates() {
    return window.electronAPI.pullRemoteUpdates();
  }

  async onDeepLink(cb: (payload: any) => void) {
    if (!window.electronAPI?.onDeepLink) return;
    return window.electronAPI.onDeepLink(cb);
  }

  connectCalendar(userId?: string|null) {
    return window.electronAPI.calendarAPI.connect(userId);
  }
  disconnectCalendar(userId?: string|null) {
    return window.electronAPI.calendarAPI.disconnect(userId);
  }
  getCalendarStatus(userId?: string|null) {
    return window.electronAPI.calendarAPI.getStatus(userId);
  }
  async getCalendarEvents(payload?: any) {
    return window.electronAPI.calendarAPI.getEvents(payload);
  }
  async syncCalendar(userId?: string|null) {
    return window.electronAPI.calendarAPI.syncCalendar(userId);
  }
  async createCalendarEvent(payload: any) {
    return window.electronAPI.calendarAPI.createEvent(payload);
  }
  async deleteCalendarEvent(payload: any) {
    return window.electronAPI.calendarAPI.deleteEvent(payload);
  }

  async orgSummary() {
    return window.electronAPI.admin.orgSummary();
  }
  async taskThroughPut() {
    return window.electronAPI.admin.taskThroughPut();
  }
  async topPerformance() {
    return window.electronAPI.admin.topPerformance();
  }
  async teamUtilization() {
    return window.electronAPI.admin.teamUtilization();
  }
  async projectLoad() {
    return window.electronAPI.admin.projectLoad();
  }
  async focusHeatmap() {
    return window.electronAPI.admin.focusHeatmap();
  }
  async userActivityHeatMap(userId?: string, days?: number, perUserGrid?: boolean) {
    return window.electronAPI.admin.userActivityHeatMap(userId, days, perUserGrid);
  }
  async appUsage(days?: number, limit?: number, userId?: string) {
    return window.electronAPI.admin.appUsage(days, limit, userId);
  }
  async forceRefreshSummaries() {
    return window.electronAPI.admin.forceRefreshSummaries();
  }
}
