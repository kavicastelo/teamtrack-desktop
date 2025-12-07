import fetch from 'node-fetch';
import { DatabaseService } from './db/database.service.js';
import { users } from "../drizzle/shema";
import { AuthService } from "../electron/services/auth.service";
import { eq } from "drizzle-orm";
import { EventEmitter } from "events";

export class GoogleCalendarSyncService extends EventEmitter {
    private interval: NodeJS.Timeout | null = null;
    private readonly DEFAULT_INTERVAL_MS = Number(process.env.CALENDAR_SYNC_INTERVAL_MS) || 5 * 60 * 1000; // default 5min
    private db: any
    private auth: any

    // per-user refresh locks to avoid concurrent refresh races
    private refreshLocks: Map<string, Promise<any>> = new Map();
    private readonly CONCURRENCY = 3;

    constructor(private dbService: DatabaseService, private authService: AuthService) {
        super();
        this.db = dbService;
        this.auth = authService;
    }

    start() {
        if (this.interval) return;
        // cleanup once at start
        this.cleanupFailedCalendarRevisions().catch(err => console.error("cleanup failed", err));

        this.interval = setInterval(() => {
            this.runSync().catch(err => console.error("[CalendarSync] runSync failed", err));
        }, this.DEFAULT_INTERVAL_MS);

        console.log('[CalendarSync] Started background calendar worker');
        // run one immediate pass (not awaited)
        this.runSync().catch(err => console.error("[CalendarSync] initial runSync failed", err));
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
        this.interval = null;
    }

    async runSync() {
        try {
            const orm = this.db.getOrm();
            const usersToSync = await orm.select()
                .from(users)
                .where(eq(users.calendar_sync_enabled, 1));

            await this.runConcurrent(usersToSync, this.CONCURRENCY, async (u: any) => {
                await this.syncGoogleToLocal(u.id);
            });
        } catch (err) {
            console.error("[BackgroundSync] runSync error:", err);
        }
    }

    // sync google -> local for a user
    async syncGoogleToLocal(userId: string) {
        try {
            // ensureAccessToken should use the per-user lock below to avoid concurrent refreshes
            const tokens = await this.ensureAccessTokenWithLock(userId);
            // get calendar id from user's profile
            const user = await this.auth.getUserById(userId);
            if (!user || !user.calendar_sync_enabled) {
                console.warn(`[CalendarSync] Skipping user ${userId} — calendar disabled or user missing`);
                return;
            }
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
                const res = await fetch(url, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
                const data = await res.json();

                if (data.error) {
                    throw new Error(`Google API error: ${JSON.stringify(data.error)}`);
                }

                const items = data.items || [];
                for (const ev of items) {
                    if (ev.status === 'cancelled') {
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
        } catch (err: any) {
            if (err.message && err.message.includes("invalid_grant")) {
                console.log(`[CalendarSync] Token invalid for user ${userId}. Auto-disconnected.`);

                this.dbService.createNotification({
                    user_id: userId,
                    type: "calendar_token_invalid",
                    title: "Google Calendar Sync Disconnected",
                    message: "Your Google Calendar connection expired or was revoked. Please reconnect it to resume syncing.",
                    data: { reason: "invalid_grant" }
                });

                // don't rethrow so the background worker continues
                return;
            }
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

    // wrapper to serialize refresh per user
    private async ensureAccessTokenWithLock(userId: string) {
        // if a refresh is already in flight for this user, wait for it
        const existing = this.refreshLocks.get(userId);
        if (existing) {
            return existing;
        }

        // create a promise for the ensure operation and store as lock
        const p = (async () => {
            try {
                // delegate to authService.ensureAccessToken (unchanged)
                return await this.auth.ensureAccessToken(userId);
            } finally {
                // clear lock
                this.refreshLocks.delete(userId);
            }
        })();

        this.refreshLocks.set(userId, p);
        return p;
    }

    async runConcurrent<T>(items: T[], limit: number, fn: (item: T) => Promise<any>) {
        const queue = [...items];
        const running = new Set();

        const next = async () => {
            if (queue.length === 0) return;
            const item = queue.shift();
            const p = fn(item)
                .catch(err => console.error("sync error", err))
                .finally(() => running.delete(p));

            running.add(p);

            if (running.size < limit) next();
            await p;
            if (queue.length > 0) next();
        };

        const starters = Math.min(limit, queue.length);
        for (let i = 0; i < starters; i++) await next();

        await Promise.all(running);
    }

    async cleanupFailedCalendarRevisions() {
        await this.dbService.query(`
            DELETE FROM revisions
            WHERE object_type = 'calendar_events'
            AND synced = -1
        `);
    }
}
