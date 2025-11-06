import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AES, enc } from 'crypto-js';
import { BrowserWindow } from 'electron';
import { EventEmitter } from 'events';
import type { Session } from '@supabase/supabase-js';
import {localSession, users} from "../../drizzle/shema";
import {eq} from "drizzle-orm";
import Utf8 from "crypto-js/enc-utf8";
const Store = require('electron-store');
const store = new Store();

export class AuthService extends EventEmitter {
    private readonly supabase: SupabaseClient; // client with anon key for auth flows (current)
    private readonly adminClient?: SupabaseClient; // server/client with service_role for admin
    private session: Session | null = null;
    private readonly encryptionKey = process.env.LOCAL_ENCRYPT_KEY || 'local_key';
    private readonly supabaseUrl: string;
    private dbService: any;
    private mainWindow?: BrowserWindow;

    private TOKEN_ROW_PREFIX = "google_calendar_";

    constructor(opts: {
        supabaseUrl: string;
        supabaseKey: string; // anon or client key (limited)
        db: any;
        mainWindow?: BrowserWindow;
    }) {
        super();
        this.supabaseUrl = opts.supabaseUrl;
        this.supabase = createClient(opts.supabaseUrl, opts.supabaseKey, {
            auth: { persistSession: false },
        });

        // Create admin client if service role provided — used only inside main process.
        const serviceRole = process.env.SUPABASE_SERVICE_ROLE;
        if (serviceRole) {
            this.adminClient = createClient(this.supabaseUrl, serviceRole, {
                auth: { persistSession: false },
            });
        } else {
            console.warn('[AuthService] SUPABASE_SERVICE_ROLE not set — admin actions disabled.');
        }

        this.dbService = opts.db;
        this.mainWindow = opts.mainWindow;
    }

    /** Sign in with magic link */
    async signIn(email: string) {
        const { error } = await this.supabase.auth.signInWithOtp({ email });
        if (error) throw error;
        return { message: 'Verification link sent to email.' };
    }

    /** Google OAuth login (keeps) */
    async signInWithGoogle() {
        const { data, error } = await this.supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: 'myapp://auth/callback'
            },
        });
        if (error) throw error;
        return data.url;
    }

    /** Handle auth callback (keeps) */
    async handleCallback(url: string) {
        const u = new URL(url);
        const params = Object.fromEntries(new URLSearchParams(u.search));
        const hashParams = Object.fromEntries(new URLSearchParams(u.hash.replace(/^#/, '')));

        try {
            let session;

            if (params['code']) {
                const { data, error } = await this.supabase.auth.exchangeCodeForSession(params['code']);
                if (error) throw error;
                session = data.session;
            } else if (hashParams['access_token']) {
                const { access_token, refresh_token } = hashParams;
                const { data, error } = await this.supabase.auth.setSession({
                    access_token,
                    refresh_token,
                });
                if (error) throw error;
                session = data.session;
            } else {
                throw new Error('Invalid callback URL: no code or access_token found');
            }

            this.session = session;
            await this.saveSessionLocally(session);

            const userId = session.user?.id;
            if (userId) {
                const existingUser = await this.getUserById(userId);
                if (!existingUser) {
                    const now = Date.now();
                    this.dbService.createUser({
                        id: userId,
                        email: session.user.email,
                        role: 'member',
                        invited_at: now,
                        updated_at: now
                    });
                }
                store.set('currentUserId', userId);
            }

            return {
                session,
                user: session.user,
            };
        } catch (err) {
            console.error('[handleCallback] Error:', err);
            throw err;
        }
    }

    private async saveSessionLocally(session: Session) {
        const encrypted = AES.encrypt(JSON.stringify(session), this.encryptionKey).toString();
        const db = this.dbService.getOrm();

        // Delete existing session first
        await db.delete(localSession).where(eq(localSession.id, 'session'));

        // Insert new session
        await db.insert(localSession).values({
            id: 'session',
            session_encrypted: encrypted,
        });
    }

    private async clearLocalSession() {
        const db = this.dbService.getOrm();
        await db.delete(localSession).where(eq(localSession.id, 'session'));
    }

    async signOut() {
        await this.supabase.auth.signOut();
        const db = this.dbService.getOrm();

        await db.delete(localSession).where(eq(localSession.id, 'session'));
        this.session = null;
    }

    async restoreSession() {
        const db = this.dbService.getOrm();

        const rows = await db
            .select()
            .from(localSession)
            .where(eq(localSession.id, 'session'))
            .limit(1);

        if (!rows || rows.length === 0) return null;

        const row = rows[0];
        const decrypted = AES.decrypt(row.session_encrypted, this.encryptionKey).toString(enc.Utf8);
        const session = JSON.parse(decrypted);

        const { data, error } = await this.supabase.auth.setSession(session);
        if (error) {
            console.warn("Session expired -> clearing");
            await this.clearLocalSession();
            return null;
        }

        // Keep fresh tokens
        await this.saveSessionLocally(data.session);

        this.session = data.session;

        return {
            session: data.session,
            user: data.session.user,
        };
    }

    // -------------------------
    // Admin / user management
    // -------------------------

    /**
     * Invite a user by email (admin operation). Uses service_role client.
     * - role: custom role string (e.g. 'admin' | 'member')
     * - teamId: optional - if provided, will insert into team_members table
     */
    async inviteUser(email: string, role: string, teamId?: string) {
        if (!this.adminClient) throw new Error('Admin client not configured (SUPABASE_SERVICE_ROLE missing)');

        // Determine redirect target
        const redirectTo =
            process.env.NODE_ENV === 'development'
                ? 'myapp://auth/invite-complete'
                : process.env.APP_PROTOCOL_ENABLED
                    ? 'myapp://auth/invite-complete'
                    : 'https://courses.talentboozt.com/auth/invite-complete';

        const { data, error } = await this.adminClient.auth.admin.inviteUserByEmail(email, { redirectTo });
        if (error) throw error;

        const userId = data.user?.id;
        if (userId) {
            const now = Date.now();
            this.dbService.createUser({
                id: userId,
                email: data.user.email,
                role,
                invited_at: now,
                updated_at: now
            });

            if (teamId) {
                this.dbService.createTeamMember({
                    team_id: teamId,
                    user_id: userId,
                    role,
                    created_at: now
                });
            }
        }

        return data.user;
    }

    /** List users from users table (returns profile rows). Good for admin UI. */
    async listUsers() {
        // prefer users table endpoint; it is safer than admin.listUsers, but if you want admin list, can call admin API.
        const client = this.adminClient ?? this.supabase;
        const { data, error } = await client.from('users').select('*').order('updated_at', { ascending: false });
        if (error) throw error;
        return data;
    }

    /** Get single user profile by id */
    async getUserById(userId: string) {
        const client = this.adminClient ?? this.supabase;
        const { data, error } = await client.from('users').select('*').eq('id', userId).maybeSingle();
        if (error) throw error;
        return data;
    }

    /** Update role in users (and optionally team_members role) */
    async updateUserRole(userId: string, role: string, teamId?: string) {
        const client = this.adminClient ?? this.supabase;
        const { data, error } = await client.from('users').update({ role }).eq('id', userId);
        if (error) throw error;
        const payload = {role: role, userId: userId}
        await this.dbService.updateUserRole(payload);

        if (teamId) {
            // update team member role as well
            await client.from('team_members').update({ role }).match({ team_id: teamId, user_id: userId });
            const payload = {role: role, user_id: userId, team_id: teamId}
            await this.dbService.updateTeamMemberRole(payload);
        }
        return data;
    }

    /** Soft-remove user from app: delete profile and team memberships.
     *  If you want to fully delete auth user you must call admin.deleteUser (service role) — BE CAREFUL.
     */
    async removeUser(userId: string, hardDelete = false) {
        const client = this.adminClient ?? this.supabase;

        // remove from team_members and users
        await client.from('team_members').delete().eq('user_id', userId);
        await client.from('users').delete().eq('id', userId);

        if (hardDelete) {
            if (!this.adminClient) throw new Error('Hard delete requires service_role key (admin client).');
            const { error } = await this.adminClient.auth.admin.deleteUser(userId);
            if (error) throw error;
        }

        return { ok: true };
    }

    /** Update password (must be logged in) */
    async updatePassword(newPassword: string) {
        const { error } = await this.supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        return { ok: true };
    }

    async updateProfile(profile: any) {
        const { error } = await this.supabase.from('users').update(profile).eq('id', profile.id);
        if (error) throw error;
        this.dbService.updateUserProfile(profile);
        return { ok: true };
    }

    async updateCalendarInfo(payload: any) {
        const { error } = await this.supabase.from('users').update(payload).eq('id', payload.id);
        if (error) throw error;
        this.dbService.updateUserCalendarSync(payload);
        return { ok: true };
    }

    getCurrentUser() {
        if (this.session) {
            const session = this.session;
            return {
                session,
                user: session.user,
            };
        } else {
            return null;
        }
    }

    // Save tokens (update to save per-user key and expiry)
    async saveCalendarTokens(tokenData: any, userId: string) {
        const orm = this.dbService.getOrm();
        if (!userId) throw new Error("userId required to save calendar tokens");

        // compute expiry time (expires_in from google) - keep ms
        if (tokenData.expires_in) {
            tokenData.expires_at = Date.now() + tokenData.expires_in * 1000;
        }

        const encrypted = AES.encrypt(JSON.stringify(tokenData), this.encryptionKey).toString();

        const rowId = this.TOKEN_ROW_PREFIX + userId;
        await orm.insert(localSession).values({
            id: rowId,
            session_encrypted: encrypted
        }).onConflictDoUpdate({
            target: localSession.id,
            set: { session_encrypted: encrypted }
        });

        // fetch primary calendar and update user profile (same as you do)
        const calendarId = await this.fetchPrimaryCalendar(tokenData.access_token);

        const payload = {
            id: userId,
            google_refresh_token: tokenData.refresh_token || (await this.getUserById(userId)).google_refresh_token,
            google_calendar_id: calendarId,
            calendar_sync_enabled: 1,
            last_calendar_sync: Date.now()
        };

        await this.updateCalendarInfo(payload);
        return calendarId;
    }

// read tokens blob for a given user
    async getCalendarTokens(userId: string) {
        const orm = this.dbService.getOrm();
        const rowId = this.TOKEN_ROW_PREFIX + userId;
        try {
            const row: any = await orm.select().from(localSession).where(eq(localSession.id, rowId)).limit(1).get(); // adapt to query API
            if (!row) return null;
            const decrypted = AES.decrypt(row.session_encrypted, this.encryptionKey).toString(Utf8);
            const tokenData = JSON.parse(decrypted);
            return tokenData;
        } catch (err) {
            console.warn("[AuthService] getCalendarTokens:", err);
            return null;
        }
    }

// Refresh access token using refresh_token, store new tokens (preserve refresh_token if not returned)
    async refreshAccessToken(userId: string, tokenData: any) {
        if (!tokenData?.refresh_token) throw new Error("No refresh_token available to refresh access token");

        const body = new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            grant_type: "refresh_token",
            refresh_token: tokenData.refresh_token
        }).toString();

        const res = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body
        });

        const fresh = await res.json();
        if (fresh.error) throw new Error(`Refresh token failed: ${JSON.stringify(fresh)}`);

        // google returns access_token, expires_in, maybe scope, maybe token_type
        const merged = {
            ...tokenData,
            access_token: fresh.access_token,
            expires_in: fresh.expires_in,
            expires_at: fresh.expires_in ? Date.now() + fresh.expires_in * 1000 : tokenData.expires_at
        };

        // save back (re-use save path)
        const rowId = this.TOKEN_ROW_PREFIX + userId;
        const encrypted = AES.encrypt(JSON.stringify(merged), this.encryptionKey).toString();
        const orm = this.dbService.getOrm();
        await orm.insert(localSession).values({ id: rowId, session_encrypted: encrypted }).onConflictDoUpdate({
            target: localSession.id,
            set: { session_encrypted: encrypted }
        });

        return merged;
    }

// Ensure a valid access token (refresh if expired)
    async ensureAccessToken(userId: string) {
        let tokens = await this.getCalendarTokens(userId);

        // fallback: if local token not found, attempt to get refresh token from user record
        if (!tokens) {
            const user = await this.getUserById(userId);
            if (!user) throw new Error("No user found");
            tokens = { refresh_token: user.google_refresh_token };
        }

        if (!tokens) throw new Error("No calendar tokens available");

        // If we have expires_at and it's in future minus 60s, return
        if (tokens.access_token && tokens.expires_at && tokens.expires_at > Date.now() + 60 * 1000) {
            return tokens;
        }

        // otherwise refresh using refresh_token
        if (!tokens.refresh_token) throw new Error("No refresh_token to refresh access token");
        const refreshed = await this.refreshAccessToken(userId, tokens);
        return refreshed;
    }

    async fetchPrimaryCalendar(accessToken: string) {
        const res = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const data = await res.json();
        const primary = data.items.find((c: any) => c.primary);
        return primary?.id || data.items[0]?.id;
    }
}
