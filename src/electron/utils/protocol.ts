import { app } from "electron";
import path from "path";

export function registerProtocolHandlers(protocolName: string) {
    if (process.defaultApp) {
        const exe = process.execPath;
        const arg = process.argv[1];
        app.setAsDefaultProtocolClient(protocolName, exe, [path.resolve(arg)]);
    } else {
        app.setAsDefaultProtocolClient(protocolName);
    }
}
