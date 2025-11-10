import { app } from "electron";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

import { createMainWindow, getMainWindow } from "./windows/main-window";
import { registerIPCHandlers } from "./ipc/ipc-handlers";
import { initializeAppServices, shutdownServices, checkForUpdates } from "./services/app-services";
import { registerProtocolHandlers } from "./utils/protocol";
import dns from "dns";

const logFile = path.join(app.getPath("userData"), "startup.log");

let deepLinkUrl: string | null = null;

const envPath = app.isPackaged
    ? path.join(process.resourcesPath, "app.asar.unpacked", ".env") // packaged app
    : path.join(process.cwd(), ".env");        // dev mode (IntelliJ / terminal)
dotenv.config({ path: envPath });

fs.writeFileSync(logFile, "ENV path: " + envPath + "\n");

// Ensure single instance
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

// Handle deep link before app ready (Windows)
const protocolName = "myapp";
if (process.platform === "win32") {
    const deepArg = process.argv.find(arg => arg.startsWith(`${protocolName}://`));
    if (deepArg) deepLinkUrl = deepArg;
}

function checkInternetConnection() {
    return new Promise((resolve) => {
        dns.lookup("google.com", (err) => resolve(!err));
    });
}

app.on("second-instance", (_, argv) => {
    const url = argv.find(a => a.startsWith(`${protocolName}://`));
    const mainWindow = getMainWindow();
    if (url && mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
        mainWindow.webContents.send("deep-link", url);
    }
});

app.on("open-url", (event, url) => {
    event.preventDefault();
    const mainWindow = getMainWindow();
    if (mainWindow) mainWindow.webContents.send("deep-link", url);
    else deepLinkUrl = url;
});

app.whenReady().then(async () => {
    const online = await checkInternetConnection();
    if (!online) {
        const { dialog } = require("electron");
        dialog.showErrorBox(
            "Network Required",
            "An active internet connection is required to start the application."
        );
        app.exit(1);
        return;
    }
    await checkForUpdates();
    try {
        fs.writeFileSync(logFile, "App starting...\n");
        const mainWindow = createMainWindow(deepLinkUrl);
        registerProtocolHandlers(protocolName);
        const services = await initializeAppServices(mainWindow);
        registerIPCHandlers(services);
    } catch (err) {
        fs.writeFileSync(logFile, "[Main] Startup error: " + err + "\n");
        console.error("[Main] Startup error:", err);
        app.removeAllListeners("before-quit");
        app.exit(1);
    }
});

app.on("activate", () => {
    if (!getMainWindow()) createMainWindow();
});

app.on("before-quit", (event) => {
    if (!shutdownServices) return; // safety check
    event.preventDefault();

    Promise.resolve()
        .then(() => shutdownServices())
        .finally(() => app.exit());
});
