import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
// import { DatabaseService } from '../node/db/database.service';
// import { SupabaseSyncService } from '../node/supabase-sync.service';
import Store from 'electron-store';
import 'dotenv/config';

const store = new Store();
let mainWindow: BrowserWindow | null = null;
// let dbService: DatabaseService;
// let syncService: SupabaseSyncService;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    const devUrl = process.env.ELECTRON_START_URL || 'file://' + path.join(__dirname, '../../src/app/dist/app/browser/index.html');
    mainWindow.loadURL(devUrl).then(r => {
        console.log(devUrl);
    }).catch(e => {
        console.error(e);
    });
}

app.whenReady().then(async () => {
    createWindow();

    // // Initialize DB service (ensures db file exists)
    // dbService = new DatabaseService({
    //     dbPath: path.join(app.getPath('userData'), 'teamtrack.db.enc'), // encrypted path
    //     encryptionKey: store.get('dbKey') as string // manage this securely
    // });
    // await dbService.open(); // decrypt -> open
    //
    // // Start sync
    // syncService = new SupabaseSyncService({
    //     supabaseUrl: process.env.SUPABASE_URL!,
    //     supabaseKey: process.env.SUPABASE_ANON_KEY!,
    //     db: dbService
    // });
    // syncService.start();
    //
    // // IPC handlers - minimal
    // ipcMain.handle('db:query', async (event, q, params) => {
    //     return dbService.query(q, params);
    // });
    // ipcMain.handle('task:create', async (event, payload) => {
    //     const task = await dbService.createTask(payload);
    //     // push to local events log for sync
    //     await dbService.logEvent({ action: 'task:create', object_type: 'task', object_id: task.id, payload: task });
    //     // return created row
    //     return task;
    // });

});

app.on('before-quit', async () => {
    // gracefully stop sync and close DB (encrypt)
    // if (syncService) await syncService.stop();
    // if (dbService) await dbService.close();
});
