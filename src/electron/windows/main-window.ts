import {app, BrowserWindow, dialog} from "electron";
import path from "path";
import dotenv from "dotenv";

const envPath = app.isPackaged
    ? path.join(process.resourcesPath, "app.asar.unpacked", ".env")
    : path.join(process.cwd(), ".env");
dotenv.config({ path: envPath });

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
        `file://${path.join(__dirname, "../../../src/app/dist/app/browser/index.html")}`;

    const isPackaged = app.isPackaged;
    const offlinePagePath = isPackaged
        ? path.join(process.resourcesPath, "app.asar.unpacked", "static", "offline.html")
        : path.join(process.cwd(), "src", "electron", "static", "offline.html");

    mainWindow.loadURL(startUrl).catch((err) => {
        console.error("[MainWindow] Failed to load:", err);
        mainWindow!.loadFile(offlinePagePath).catch(err2 => {
            console.error("[MainWindow] Failed to load fallback:", err2);
            dialog.showErrorBox(
                "Network Error",
                "Unable to connect to the server. Please check your internet connection and restart the app."
            );
            app.exit(1);
        });
        }
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
