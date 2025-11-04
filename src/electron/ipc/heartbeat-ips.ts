import {ipcMain} from "electron";
import {DatabaseService} from "../../node/db/database.service";
import Store from "electron-store";
const store = new Store();

export function registerHeartbeatIPC(dbService: DatabaseService) {
    const currentUserId = store.get('currentUserId');
    ipcMain.handle('get-heartbeats', async (_event, userId, startDate, endDate) => {
        if (!currentUserId && !userId) throw new Error('No user logged in');
        return dbService.getHeartbeatsForUser(userId || currentUserId, startDate, endDate);
    });

    ipcMain.handle('get-aggregated-time', async (_event, userId, startDate, endDate) => {
        if (!currentUserId && !userId) throw new Error('No user logged in');
        return dbService.getAggregatedTimeByApp(userId || currentUserId, startDate, endDate);
    });

    ipcMain.handle('get-daily-activity', async (_event, userId, startDate, endDate) => {
        if (!currentUserId && !userId) throw new Error('No user logged in');
        return dbService.getDailyActivity(userId || currentUserId, startDate, endDate);
    });
}