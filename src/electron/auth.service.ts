import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AES, enc } from 'crypto-js';
import { BrowserWindow } from 'electron';
import { EventEmitter } from 'events';
import type { Session } from '@supabase/supabase-js';

export class AuthService extends EventEmitter {
    private readonly supabase: SupabaseClient; // client with anon key for auth flows (current)
    private readonly adminClient?: SupabaseClient; // server/client with service_role for admin
    private session: Session | null = null;
    private readonly encryptionKey = process.env.LOCAL_ENCRYPT_KEY || 'local_key';
    private readonly supabaseUrl: string;
    private dbService: any;
    private mainWindow?: BrowserWindow;

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
            options: { redirectTo: process.env.ELECTRON_START_URL + '/auth/callback' },
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
            if (params['code']) {
                const { data, error } = await this.supabase.auth.exchangeCodeForSession(params['code']);
                if (error) throw error;
                this.session = data.session;
                this.saveSessionLocally(data.session);
                return data.session;
            }

            if (hashParams['access_token']) {
                const { access_token, refresh_token } = hashParams;
                const { data, error } = await this.supabase.auth.setSession({
                    access_token,
                    refresh_token,
                });
                if (error) throw error;
                this.session = data.session;
                this.saveSessionLocally(data.session);
                return data.session;
            }

            throw new Error('Invalid callback URL: no code or access_token found');
        } catch (err) {
            console.error('[handleCallback] Error:', err);
            throw err;
        }
    }

    private saveSessionLocally(session: Session) {
        const encrypted = AES.encrypt(JSON.stringify(session), this.encryptionKey).toString();
        const db = this.dbService.getOrm();
        db.prepare(`INSERT OR REPLACE INTO local_session (id, session_encrypted) VALUES (?, ?)`).run(
            'session',
            encrypted
        );
    }

    async signOut() {
        await this.supabase.auth.signOut();
        const db = this.dbService.getOrm();
        db.prepare(`DELETE FROM local_session WHERE id = ?`).run('session');
        this.session = null;
    }

    async restoreSession() {
        const db = this.dbService.getOrm();
        const row = db
            .prepare(`SELECT session_encrypted FROM local_session WHERE id = ?`)
            .get('session');
        if (!row) return null;
        const decrypted = AES.decrypt(row.session_encrypted, this.encryptionKey).toString(enc.Utf8);
        this.session = JSON.parse(decrypted);
        return this.session;
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

        // invite via admin
        const { data, error } = await this.adminClient.auth.admin.inviteUserByEmail(email, {
            redirectTo: process.env.APP_PROTOCOL_ENABLED
                ? 'myapp://auth/invite-complete'
                : 'https://courses.talentboozt.com/auth/invite-complete', //for testing
        });

        if (error) throw error;

        // create profile in your app table (users)
        const userId = data.user?.id;
        if (userId) {
            const userPayload = {
                id: data.user.id,
                email: data.user.email,
                role,
                invited_at: Date.now(),
            }

            this.dbService.createUser(userPayload);

            if (teamId) {
                const teamMemberPayload = {
                    team_id: teamId,
                    user_id: userId,
                    role,
                    created_at: Date.now(),
                }
                this.dbService.createTeamMember(teamMemberPayload);
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

        if (teamId) {
            // update team member role as well
            await client.from('team_members').update({ role }).match({ team_id: teamId, user_id: userId });
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
        return { ok: true };
    }

    getCurrentUser() { return this.session?.user || null; }
}
