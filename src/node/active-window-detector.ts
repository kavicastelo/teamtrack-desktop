import activeWin from 'active-win';
import { EventEmitter } from 'events';

export type ActiveWindow = {
    owner: { name?: string; processId?: number; path?: string };
    title?: string;
    platform?: string; // classification e.g. 'vscode', 'figma'
    timestamp: number;
};

const DEFAULT_POLL_INTERVAL = 3000; // ms

export class ActiveWindowDetectorService extends EventEmitter {
    private interval: NodeJS.Timeout | null = null;
    private lastWindowKey: string | null = null;
    private pollInterval: number;

    constructor(pollInterval = DEFAULT_POLL_INTERVAL) {
        super();
        this.pollInterval = pollInterval;
    }

    private classify(ownerName?: string, title?: string) {
        // very simple classification; replace/add patterns as needed
        const name = (ownerName || '').toLowerCase();
        const t = (title || '').toLowerCase();

        if (name.includes('code') || t.includes('vscode')) return 'vscode';
        if (name.includes('intellij') || t.includes('jetbrains')) return 'intellij';
        if (name.includes('figma')) return 'figma';
        if (name.includes('zoom') || t.includes('zoom')) return 'zoom';
        if (t.includes('meet.google.com') || name.includes('chrome') && t.includes('meet')) return 'meet';
        if (name.includes('chrome') || name.includes('chromium')) return 'browser';
        return 'other';
    }

    public start() {
        if (this.interval) return;
        this.interval = setInterval(async () => {
            try {
                const aw = await activeWin();
                if (!aw) return;

                const payload = {
                    owner: aw.owner,
                    title: aw.title,
                    platform: this.classify(aw.owner?.name, aw.title),
                    timestamp: Date.now(),
                } as ActiveWindow;
                this.emit('active-window', payload);
            } catch (err) {
                this.emit('error', err);
            }
        }, this.pollInterval);
    }

    public stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
}
