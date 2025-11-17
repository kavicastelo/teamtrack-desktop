import path from "path";
import fs from "fs";

export function runMigrations(db: any) {
    const migrationsDir = path.join(__dirname, "migrations");

    if (!fs.existsSync(migrationsDir)) {
        console.warn("[DB] No migrations folder found");
        return;
    }

    const files = fs
        .readdirSync(migrationsDir)
        .filter(f => /^\d+_.+\.sql$/.test(f))
        .sort();

    const getDbVersion = (): number => {
        try {
            const row = db.prepare(
                "SELECT value FROM schema_meta WHERE key='db_version'"
            ).get();
            return row ? Number(row.value) : 0;
        } catch {
            return 0;
        }
    };

    const setDbVersion = (v: number) => {
        db.prepare(`
            INSERT INTO schema_meta (key, value)
            VALUES ('db_version', ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `).run(v);
    };

    const currentVersion = getDbVersion();

    for (const file of files) {
        console.log(file)
        const version = Number(file.split("_")[0]);
        if (version <= currentVersion) continue;

        const fullPath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(fullPath, "utf8");

        console.log(`[DB] Applying migration ${file}`);

        db.exec("BEGIN");
        try {
            db.exec(sql);
            setDbVersion(version);
            db.exec("COMMIT");
        } catch (err) {
            db.exec("ROLLBACK");
            console.error("[DB] Migration failed:", err);
            throw err;
        }
    }
}
