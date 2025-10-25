import fetch from 'node-fetch';
import { DatabaseService } from './db/database.service.js';
import crypto from 'crypto';
import {users} from "../drizzle/shema";
import {AuthService} from "../electron/services/auth.service";
import {eq} from "drizzle-orm";
import {EventEmitter} from "events";

export class GoogleCalendarSyncService extends EventEmitter {
    private interval: NodeJS.Timeout | null = null;
    private readonly SYNC_INTERVAL = 1000 * 60 * 2; // 2 min
    private db: any
    private auth: any

    constructor(private dbService: DatabaseService, private authService: AuthService) {
        super();
        this.db = dbService;
        this.auth = authService;
    }

    start() {
        if (this.interval) return;
        this.interval = setInterval(() => this.runSync(), this.SYNC_INTERVAL);
        console.log('[CalendarSync] Started background calendar worker');
        this.runSync().then(); // run once immediately
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
        this.interval = null;
    }

    async runSync() {
        const intervalMs = Number(process.env.CALENDAR_SYNC_INTERVAL_MS) || 5 * 60 * 1000; // default 5min
        this.interval = setInterval(async () => {
            try {
                const orm = this.db.getOrm();
                // query users table for users with calendar_sync_enabled
                const allUsers = await orm.select().from(users).where(eq(users.calendar_sync_enabled, 1));
                for (const u of allUsers) {
                    try {
                        await this.syncGoogleToLocal(u.id);
                    } catch (err) {
                        console.error(`[BackgroundSync] user ${u.id} sync failed`, err);
                    }
                }
            } catch (err) {
                console.error("[BackgroundSync] loop error", err);
            }
        }, intervalMs);
    }

    // sync google -> local for a user
    async syncGoogleToLocal(userId: string) {
        try {
            const tokens = await this.auth.ensureAccessToken(userId);
            // get calendar id from user's profile
            const user = await this.auth.getUserById(userId);
            if (!user) throw new Error("No user found");
            const calendarId = user.google_calendar_id;
            if (!calendarId) throw new Error("No calendar_id for user");

            let pageToken: string | undefined = undefined;
            let collected = 0;

            do {
                const qs = new URLSearchParams({
                    maxResults: "2500",
                    singleEvents: "true",
                    orderBy: "startTime",
                });
                if (pageToken) qs.set('pageToken', pageToken);

                const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${qs.toString()}`;
                const res = await fetch(url, { headers: { Authorization: `Bearer ${tokens.access_token}` }});
                const data = await res.json();

                if (data.error) {
                    throw new Error(`Google API error: ${JSON.stringify(data.error)}`);
                }

                const items = data.items || [];
                for (const ev of items) {
                    // skip cancelled or no start/end
                    if (ev.status === 'cancelled') {
                        // optionally delete local event
                        await this.db.deleteEventLocal?.(ev.id);
                        continue;
                    }
                    if (!ev.start || !ev.end) continue;
                    await this.db.upsertEventLocal(ev, userId);
                    collected++;
                }

                pageToken = data.nextPageToken;
            } while (pageToken);

            // update last_calendar_sync timestamp on user
            await this.auth.updateCalendarInfo({
                id: userId,
                last_calendar_sync: Date.now()
            });

            return collected;
        } catch (err) {
            console.error("[GoogleSync] syncGoogleToLocal error", err);
            throw err;
        }
    }

// create event on Google and local
    async createEventForUser(userId: string, startMs: number, endMs: number, summary = "") {
        const tokens = await this.auth.ensureAccessToken(userId);
        const user = await this.auth.getUserById(userId);
        if (!user) throw new Error("No user");

        const calendarId = user.google_calendar_id;
        const body = {
            summary,
            start: { dateTime: new Date(startMs).toISOString() },
            end: { dateTime: new Date(endMs).toISOString() }
        };

        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${tokens.access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const ev = await res.json();
        if (ev.error) throw new Error(`Google create event error ${JSON.stringify(ev.error)}`);

        await this.db.upsertEventLocal(ev, userId);
        return ev;
    }

// delete event
    async deleteEventForUser(userId: string, eventId: string) {
        const tokens = await this.auth.ensureAccessToken(userId);
        const user = await this.auth.getUserById(userId);
        const calendarId = user.google_calendar_id;

        await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${tokens.access_token}` }
        });

        await this.db.deleteEventLocal(eventId);
        return { ok: true };
    }
}
