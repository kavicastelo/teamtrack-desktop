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
        if (payload && payload.duration_ms) {
            this.dbService.createHeartbeat(payload);
        }
    }
}
