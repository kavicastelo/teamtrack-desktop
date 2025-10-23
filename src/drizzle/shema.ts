import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const attachments = sqliteTable('attachments', {
    id: text('id').primaryKey(),
    taskId: text('taskId').notNull(),
    filename: text('filename').notNull(),
    mimetype: text('mimetype').notNull(),
    size: integer('size'),
    supabase_path: text('supabase_path'),
    created_at: integer('created_at'),
});

export const revisions = sqliteTable('revisions', {
    id: text('id').primaryKey(),
    object_type: text('object_type').notNull(),
    object_id: text('object_id'),
    origin_id: text('origin_id'),
    seq: integer('seq'),
    payload: text('payload'),
    createdAt: integer('created_at'),
    synced: integer('synced').notNull().default(0),
});

export const localSession = sqliteTable('local_session', {
    id: text('id').primaryKey(),
    session_encrypted: text('session_encrypted'),
});

export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    full_name: text('full_name').notNull(),
    role: text('role').notNull(),
    avatar_url: text('avatar_url'),
    timezone: text('timezone').notNull(),
    calendar_sync_enabled: integer('calendar_sync_enabled').notNull().default(0),
    google_calendar_id: text('google_calendar_id').notNull().default(''),
    available_times: text('available_times').notNull().default(''),
    updated_at: integer('updated_at').notNull().default(0),
    invited_at: integer('invited_at').notNull().default(0),
    google_refresh_token: text('google_refresh_token').notNull().default(''),
    last_calendar_sync: integer('last_calendar_sync').notNull().default(0),
})
