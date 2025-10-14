import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const attachments = sqliteTable('attachments', {
    id: text('id').primaryKey(),
    taskId: text('task_id').notNull(),
    filename: text('filename').notNull(),
    mimetype: text('mimetype').notNull(),
    size: integer('size'),
    supabasePath: text('supabase_path'),
    createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow(),
});
