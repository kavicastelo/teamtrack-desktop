import { Injectable, signal } from '@angular/core';

declare global {
  interface Window {
    electronAPI: any;
    metrics: any;
  }
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  async getMyWork(userId: string) {
    return window.electronAPI.metrics.getMyWork(userId);
  }

  async getTeamPulse(teamId: string) {
    return window.electronAPI.metrics.getTeamPulse(teamId);
  }

  async getActivityTimeline(limit = 100) {
    return window.electronAPI.metrics.getActivityTimeline(limit);
  }

  async getActivityTimeByUser(userId: string, limit = 100) {
    return window.electronAPI.metrics.getActivityTimeByUser(userId, limit);
  }

  async getProjectHeatmap(days = 30) {
    return window.electronAPI.metrics.getProjectHeatmap(days);
  }
}
