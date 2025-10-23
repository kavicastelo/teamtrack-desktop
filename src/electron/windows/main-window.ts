import { BrowserWindow } from "electron";
import path from "path";

let mainWindow: BrowserWindow | null = null;

export function createMainWindow(initialDeepLink?: string | null) {
    if (mainWindow) return mainWindow;

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 840,
        webPreferences: {
            preload: path.join(__dirname, "../preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            zoomFactor: 1.0,
        },
    });

    const startUrl =
        process.env.ELECTRON_START_URL ||
        `file://${path.join(__dirname, "../../app/dist/app/browser/index.html")}`;

    mainWindow.loadURL(startUrl).catch((err) =>
        console.error("[MainWindow] Failed to load:", err)
    );

    mainWindow.webContents.once("did-finish-load", () => {
        if (initialDeepLink) {
            mainWindow!.webContents.send("deep-link", initialDeepLink);
        }
    });

    mainWindow.on("closed", () => (mainWindow = null));

    return mainWindow;
}

export function getMainWindow() {
    return mainWindow;
}
