import fetch from 'node-fetch';
import { DatabaseService } from './db/database.service.js';
import crypto from 'crypto';
import {users} from "../drizzle/shema";

export class GoogleCalendarSyncService {
    private interval: NodeJS.Timeout | null = null;
    private readonly SYNC_INTERVAL = 1000 * 60 * 2; // 2 min

    constructor(private db: DatabaseService) {}

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
        try {
            const orm = this.db.getOrm();
            const user = await orm.select().from(users).limit(1);

            if (!user?.length) return;
            const u = user[0];

            if (!u.calendar_sync_enabled || !u.google_calendar_id) return;

            const accessToken = await this.getAccessToken(u.google_refresh_token);
            if (!accessToken) return;

            const events = await this.fetchEvents(u.google_calendar_id, accessToken);
            await this.saveEventsLocally(events);

            console.log('[CalendarSync] Synced events:', events.length);
        } catch (err) {
            console.error('[CalendarSync] Error', err);
        }
    }

    async getAccessToken(refreshToken: string) {
        const res = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            }).toString()
        });

        const data = await res.json();
        return data.access_token;
    }

    async fetchEvents(calendarId: string, accessToken: string) {
        const timeMin = new Date().toISOString();
        const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?timeMin=${timeMin}`;

        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const data = await res.json();
        return data.items || [];
    }

    async saveEventsLocally(events: any[]) {
        // map events into your local "events" table
        // insert/upsert logic here…
    }
}
