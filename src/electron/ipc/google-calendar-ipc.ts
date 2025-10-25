import {ipcMain, shell} from 'electron';
import {AuthService} from '../services/auth.service.js';
import {DatabaseService} from '../../node/db/database.service.js';
import {calendar_events, users} from "../../drizzle/shema";
import {asc, eq} from "drizzle-orm";
import crypto from "crypto";

export function registerGoogleCalendarIPC(authService: AuthService, dbService: DatabaseService) {
    ipcMain.handle("google-calendar:connect", async (_, userId: string | null) => {
        const clientId = process.env.GOOGLE_CLIENT_ID!;
        const redirectUri = "http://127.0.0.1:47845/google-auth";

        const state = JSON.stringify({
            userId,
            nonce: generateNonce(),
            ts: Date.now(),
        });

        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.readonly');
        authUrl.searchParams.set('prompt', 'consent');
        authUrl.searchParams.set("state", state);

        await shell.openExternal(authUrl.toString());
        return { success: true };
    });

    ipcMain.handle('google-calendar:disconnect', async (_, userId: string|null) => {
        const orm = dbService.getOrm();
        const originUser = userId ? await authService.getUserById(userId) : authService.getCurrentUser()
        if (!originUser.user) return { success: false };
        await orm.update(users)
            .set({ calendar_sync_enabled: 0, google_refresh_token: '', google_calendar_id: '' })
            .where(eq(users.id, originUser.user.id));
        return { success: true };
    });

    ipcMain.handle('google-calendar:get-status', async (_, userId: string|null) => {
        const originUser = userId ? await authService.getUserById(userId) : authService.getCurrentUser()
        if (!userId && !originUser.user) return { connected: false };
        if (!originUser) return { connected: false };
        const u = originUser;
        return {
            connected: !!u.google_refresh_token,
            calendar_id: u.google_calendar_id,
            sync_enabled: !!u.calendar_sync_enabled
        };
    });

    ipcMain.handle("google-calendar:get-events", async (_, calendarId?: string|null) => {
        const orm = dbService.getOrm();
        if (calendarId) return await orm.select().from(calendar_events).where(eq(calendar_events.calendar_id, calendarId)).orderBy(asc(calendar_events.start));
        return await orm.select().from(calendar_events).orderBy(asc(calendar_events.start));
    });

    // UTILS
    function generateNonce() {
        return crypto.randomBytes(16).toString("hex");
    }
}
