import { Injectable } from '@angular/core';

declare global {
  interface Window {
    electronAPI: any;
    hb: any;
  }
}

@Injectable({
  providedIn: 'root'
})
export class TimeTrackingService {

  async getHeartbeats(userId: string|null, startDate: number, endDate: number): Promise<any[]> {
    return window.electronAPI.hb.getHeartbeatsForUser(userId, startDate, endDate);
  }

  async getAggregatedTime(userId: string|null, startDate: number, endDate: number): Promise<any[]> {
    return window.electronAPI.hb.getAggregatedTimeByApp(userId, startDate, endDate);
  }

  async getDailyActivity(userId: string|null, startDate: number, endDate: number): Promise<any[]> {
    return window.electronAPI.hb.getDailyActivity(userId, startDate, endDate);
  }
}
