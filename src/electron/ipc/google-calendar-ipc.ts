import { ipcMain, shell } from 'electron';
import { AuthService } from '../services/auth.service.js';
import { DatabaseService } from '../../node/db/database.service.js';
import {users} from "../../drizzle/shema";

export function registerGoogleCalendarIPC(authService: AuthService, dbService: DatabaseService) {
    ipcMain.handle('google-calendar:connect', async (event) => {
        const clientId = process.env.GOOGLE_CLIENT_ID!;
        const redirectUri = 'http://127.0.0.1:47845/google-auth'; // handled by LocalCollectorServer

        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.readonly');
        authUrl.searchParams.set('prompt', 'consent');

        // Open system browser for OAuth
        await shell.openExternal(authUrl.toString());
        return { success: true };
    });

    ipcMain.handle('google-calendar:disconnect', async () => {
        const orm = dbService.getOrm();
        await orm.update(users)
            .set({ calendar_sync_enabled: 0, google_refresh_token: '', google_calendar_id: '' });
        return { success: true };
    });

    ipcMain.handle('google-calendar:get-status', async () => {
        const orm = dbService.getOrm();
        const user = await orm.select().from(users).limit(1);
        if (!user.length) return { connected: false };
        const u = user[0];
        return {
            connected: !!u.google_refresh_token,
            calendar_id: u.google_calendar_id,
            sync_enabled: !!u.calendar_sync_enabled
        };
    });
}
