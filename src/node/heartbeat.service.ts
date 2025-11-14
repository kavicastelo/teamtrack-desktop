import {app} from "electron";
import {getMainWindow} from "../electron/windows/main-window";
import Store from "electron-store";
const store = new Store();

export class HeartbeatService {
    private dbService: any;
    private authService: any;
    private intervalId: NodeJS.Timeout | null = null;

    constructor(authService: any, dbService: any) {
        this.dbService = dbService;
        this.authService = authService;
    }

    start(intervalMs = 15000) {
        const user = this.authService.getCurrentUser();
        if (!user) {
            console.warn('[HeartbeatService] No user logged in, skipping start.');
            return;
        }

        console.log(`[HeartbeatService] Starting heartbeats for ${user.id}`);
        this.intervalId = setInterval(() => this.recordHeartbeat(), intervalMs);
    }

    stop() {
        if (this.intervalId) clearInterval(this.intervalId);
        this.intervalId = null;
        console.log('[HeartbeatService] Stopped.');
    }

    recordHeartbeat(payload?: any) {
        const user = this.authService.getCurrentUser();
        if (!user) {
            console.warn('[HeartbeatService] No user, skipping heartbeat.');
            return;
        }

        if (!payload) {
            // Default: app-level heartbeat (e.g., user active in your Electron app)
            payload = {
                user_id: user.id,
                timestamp: Date.now(),
                duration_ms: 15000,  // Matches your interval; adjust as needed
                source: 'app',
                platform: 'electron',
                app: app.getName() || 'MyApp',
                title: getMainWindow()?.getTitle() || 'Main Window',
                metadata: {},
                team_id: user.default_team_id || this.dbService.getCurrentTeam(user.id) || null,
                last_seen: Date.now()
            };
        } else {
            // Ensure user/team for external payloads (e.g., extensions)
            const userId = store.get('currentUserId');
            payload.user_id = payload.user_id || user.id;
            payload.team_id = payload.team_id || this.dbService.teamIds(userId)[0] || null;
        }

        this.dbService.createHeartbeat(payload);
    }
}
