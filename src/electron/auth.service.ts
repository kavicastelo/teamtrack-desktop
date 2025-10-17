import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { AES, enc } from 'crypto-js';
import {BrowserWindow} from "electron";
import EventEmitter from "events";

export class AuthService extends EventEmitter {
    private supabase: SupabaseClient;
    private session: Session | null = null;
    private readonly encryptionKey = process.env.LOCAL_ENCRYPT_KEY || 'local_key';
    private readonly supabaseUrl: string;
    private dbService: any;
    private mainWindow?: BrowserWindow;

    constructor(opts: {
        supabaseUrl: string;
        supabaseKey: string;
        db: any;
        mainWindow?: BrowserWindow;
    }) {
        super();
        this.supabaseUrl = opts.supabaseUrl;
        this.supabase = createClient(opts.supabaseUrl, opts.supabaseKey, {
            auth: {persistSession: false},
        });
        this.dbService = opts.db;
        this.mainWindow = opts.mainWindow;
    }

    /** Sign in with magic link */
    async signIn(email: string) {
        const { error } = await this.supabase.auth.signInWithOtp({ email });
        if (error) throw error;
        return { message: 'Verification link sent to email.' };
    }

    /** Google OAuth login */
    async signInWithGoogle() {
        const { data, error } = await this.supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: 'http://localhost:3000/auth/callback' }
        });
        if (error) throw error;
        return data.url;
    }

    /** Handle auth callback */
    async handleCallback(url: string) {
        const { data, error } = await this.supabase.auth.exchangeCodeForSession(
            new URL(url).searchParams.get('code') || ''
        );
        if (error) throw error;
        this.session = data.session;
        this.saveSessionLocally(data.session);
        return data.session;
    }

    private saveSessionLocally(session: Session) {
        const encrypted = AES.encrypt(JSON.stringify(session), this.encryptionKey).toString();
        const db = this.dbService.getOrm();
        db.prepare(
            `INSERT OR REPLACE INTO local_session (id, session_encrypted) VALUES (?, ?)`
        ).run('session', encrypted);
    }

    getCurrentUser() {
        return this.session?.user || null;
    }

    async signOut() {
        await this.supabase.auth.signOut();
        const db = this.dbService.getOrm();
        db.prepare(`DELETE FROM local_session WHERE id = ?`).run('session');
        this.session = null;
    }

    async restoreSession() {
        const db = this.dbService.getOrm();
        const row = db.prepare(`SELECT session_encrypted FROM local_session WHERE id = ?`).get('session');
        if (!row) return null;
        const decrypted = AES.decrypt(row.session_encrypted, this.encryptionKey).toString(enc.Utf8);
        this.session = JSON.parse(decrypted);
        return this.session;
    }
}
