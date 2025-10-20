import { app, powerMonitor } from 'electron';
import { EventEmitter } from 'events';

export class IdleMonitorService extends EventEmitter {
    private checkIntervalMs = 5000;
    private idleThresholdSec = 120; // 2 minutes
    private timer: NodeJS.Timeout | null = null;
    private isIdle = false;

    constructor(idleThresholdSec = 120, checkIntervalMs = 5000) {
        super();
        this.idleThresholdSec = idleThresholdSec;
        this.checkIntervalMs = checkIntervalMs;
    }

    start() {
        if (this.timer) return;
        this.timer = setInterval(() => {
            try {
                const secs = powerMonitor.getSystemIdleTime(); // seconds
                if (!this.isIdle && secs >= this.idleThresholdSec) {
                    this.isIdle = true;
                    this.emit('idle-start', { since: Date.now(), idleSeconds: secs });
                } else if (this.isIdle && secs < this.idleThresholdSec) {
                    this.isIdle = false;
                    this.emit('idle-end', { at: Date.now() });
                }
            } catch (err) {
                this.emit('error', err);
            }
        }, this.checkIntervalMs);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    getIdleState() {
        return this.isIdle;
    }
}
