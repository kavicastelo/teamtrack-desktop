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
