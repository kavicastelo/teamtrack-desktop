import {app, ipcMain, shell} from 'electron';
import {AuthService} from '../services/auth.service.js';
import {DatabaseService} from '../../node/db/database.service.js';
import {GoogleCalendarSyncService} from '../../node/google-calendar-sync.service.js';
import {calendar_events, users} from "../../drizzle/shema";
import {asc, eq} from "drizzle-orm";
import crypto from "crypto";

import dotenv from "dotenv";
import path from "path";
const Store = require('electron-store');
const store = new Store();

const envPath = app.isPackaged
    ? path.join(process.resourcesPath, "app.asar.unpacked", ".env")
    : path.join(process.cwd(), ".env");
dotenv.config({ path: envPath });

export function registerGoogleCalendarIPC(authService: AuthService, dbService: DatabaseService, calendarSync: GoogleCalendarSyncService) {
    const currentUserId = store.get('currentUserId');
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
        await dbService.logEvent({
            actor: currentUserId,
            action: "google-calendar:connect",
            object_type: "user",
            object_id: userId,
            payload: {
                redirect_uri: redirectUri,
                state,
            },
        })
        return { success: true };
    });

    ipcMain.handle('google-calendar:disconnect', async (_, userId: string|null) => {
        try {
            if (!userId) throw new Error("Missing userId for disconnect");

            // stop sync loop for safety
            calendarSync.stop();

            // clean up all Google calendar tokens & flags
            await authService.handleCalendarDisconnect(userId);

            // mark all calendar-related revisions as synced/stale
            await dbService.query(`
                UPDATE revisions
                SET synced = 1
                WHERE object_type = 'calendar_events'
            `);

            console.log(`[GoogleCalendar] Disconnected calendar for user ${userId}`);

            return { success: true, message: "Google Calendar disconnected successfully." };
        } catch (err) {
            console.error("[GoogleCalendar] Disconnect failed", err);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('google-calendar:get-status', async (_, userId: string|null) => {
        const originUser = userId ? await authService.getUserById(userId) : authService.getCurrentUser()
        if (!userId && !originUser) return { connected: false };
        if (!originUser) return { connected: false };
        const u = originUser;
        return {
            connected: !!u.google_refresh_token,
            calendar_id: u.google_calendar_id,
            sync_enabled: !!u.calendar_sync_enabled
        };
    });

    ipcMain.handle("google-calendar:sync", async (_, userId: string|null) => {
        if (!userId) throw new Error("userId required for sync");
        const count = await calendarSync.syncGoogleToLocal(userId);
        await dbService.logEvent({
            actor: currentUserId,
            action: "google-calendar:sync",
            object_type: "user",
            object_id: userId
        })
        return { synced: count };
    });

    ipcMain.handle("google-calendar:create-event", async (_, { userId, start, end, summary }) => {
        if (!userId) throw new Error("userId required");
        const ev = await calendarSync.createEventForUser(userId, start, end, summary);
        await dbService.logEvent({
            actor: currentUserId,
            action: "google-calendar:create-event",
            object_type: "user",
            object_id: userId,
            payload: ev
        })
        return ev;
    });

    ipcMain.handle("google-calendar:delete-event", async (_, { userId, eventId }) => {
        if (!userId) throw new Error("userId required");
        await calendarSync.deleteEventForUser(userId, eventId);
        await dbService.logEvent({
            actor: currentUserId,
            action: "google-calendar:delete-event",
            object_type: "user",
            object_id: userId
        })
        return { ok: true };
    });

    ipcMain.handle("google-calendar:ensure-token", async (_, userId: string|null) => {
        if (!userId) throw new Error("userId required");
        const tokens = await authService.ensureAccessToken(userId);
        return tokens;
    });

    ipcMain.handle("google-calendar:get-events", async (_, { calendarId, userId } : any) => {
        const orm = dbService.getOrm();
        if (userId) return await orm.select().from(calendar_events).where(eq(calendar_events.user_id, userId)).orderBy(asc(calendar_events.start));
        if (calendarId) return await orm.select().from(calendar_events).where(eq(calendar_events.calendar_id, calendarId)).orderBy(asc(calendar_events.start));
        return await orm.select().from(calendar_events).orderBy(asc(calendar_events.start));
    });

    // UTILS
    function generateNonce() {
        return crypto.randomBytes(16).toString("hex");
    }
}
