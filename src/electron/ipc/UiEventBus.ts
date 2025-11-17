import { BrowserWindow, ipcMain } from "electron";

class UiEventBus {
    private mainWindow: BrowserWindow | null = null;
    private rendererReady = false;
    private queue: Array<{ event: string; payload: any }> = [];

    initialize(mainWindow: BrowserWindow) {
        this.mainWindow = mainWindow;

        ipcMain.on("renderer-ready", () => {
            this.rendererReady = true;
            this.flushQueue();
        });
    }

    send(event: string, payload: any) {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) {
            console.warn(`[UiEventBus] Cannot send '${event}': mainWindow not ready`);
            return;
        }

        if (!this.rendererReady) {
            this.queue.push({ event, payload });
            return;
        }

        this.safeSend(event, payload);
    }

    private safeSend(event: string, payload: any) {
        try {
            this.mainWindow!.webContents.send(event, payload);
        } catch (err) {
            console.error(`[UiEventBus] Failed to send '${event}'`, err);
        }
    }

    private flushQueue() {
        for (const msg of this.queue) {
            this.safeSend(msg.event, msg.payload);
        }
        this.queue = [];
    }
}

export const uiEventBus = new UiEventBus();
