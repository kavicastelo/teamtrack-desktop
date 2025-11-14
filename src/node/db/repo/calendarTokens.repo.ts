export class CalendarTokensRepo {
    constructor(private db) {}

    get(userId: string) {
        return this.db.prepare(`
            SELECT session_encrypted
            FROM calendar_tokens
            WHERE user_id = ?
        `).get(userId);
    }

    upsert(userId: string, sessionEncrypted: string) {
        const now = Date.now();
        this.db.prepare(`
            INSERT INTO calendar_tokens (user_id, session_encrypted, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                session_encrypted = excluded.session_encrypted,
                updated_at = excluded.updated_at
        `).run(userId, sessionEncrypted, now);
    }

    delete(userId: string) {
        this.db.prepare(`
            DELETE FROM calendar_tokens WHERE user_id = ?
        `).run(userId);
    }
}
