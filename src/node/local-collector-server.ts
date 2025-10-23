import express from "express";
import http from "http";
import helmet from "helmet";
import bodyParser from "body-parser";
import jwt from "jsonwebtoken";
import WebSocket, { Server as WSS } from 'ws';
import { EventEmitter } from "events";
import fetch from "node-fetch";

const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "local_key";
const DEFAULT_PORT = 47845;

export class LocalCollectorServer extends EventEmitter {
    private app = express();
    private server: http.Server;
    private wss: WSS;
    private port: number;
    private authService?: any; // We'll inject later for saving tokens

    constructor(port = DEFAULT_PORT, authService?: any) {
        super();
        this.port = port;
        this.authService = authService;

        this.app.use(helmet());
        this.app.use(bodyParser.json({ limit: "200kb" }));

        // ---------- HEALTH ----------
        this.app.get("/status", (_req, res) => res.json({ ok: true }));

        // ---------- EPHEMERAL TOKEN ----------
        this.app.post("/token", (req, res) => {
            const token = jwt.sign(
                { client: req.body.clientId || "unknown" },
                JWT_SECRET_KEY,
                { expiresIn: "1h" }
            );
            res.json({ token });
        });

        // ---------- HEARTBEAT FROM EXTENSIONS ----------
        this.app.post("/heartbeat", (req, res) => {
            const auth = req.headers["authorization"];
            if (!auth || !auth.startsWith("Bearer "))
                return res.status(401).json({ error: "missing token" });
            const token = (auth as string).slice(7);

            try {
                const decoded = jwt.verify(token, JWT_SECRET_KEY) as any;
                const hb = req.body;
                hb.source = hb.source || "extension";
                hb.clientId = decoded.client;
                this.emit("extension-heartbeat", hb);
                return res.json({ ok: true });
            } catch {
                return res.status(401).json({ error: "invalid token" });
            }
        });

        // ---------- GOOGLE OAUTH REDIRECT HANDLER ----------
        this.app.get("/google-auth", async (req, res) => {
            const code = req.query.code as string;
            if (!code) return res.status(400).send("Missing OAuth code");

            try {
                const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: new URLSearchParams({
                        code,
                        client_id: process.env.GOOGLE_CLIENT_ID!,
                        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                        redirect_uri: `http://127.0.0.1:${this.port}/google-auth`,
                        grant_type: "authorization_code",
                    }).toString(),
                });

                const tokenData = await tokenRes.json();

                if (tokenData.error) {
                    console.error("[LocalCollector] Token exchange failed:", tokenData);
                    return res.status(400).send("Google OAuth failed. Try again.");
                }

                if (!tokenData.refresh_token) {
                    console.warn("[LocalCollector] No refresh token returned:", tokenData);
                }

                // Save tokens securely through AuthService
                if (this.authService && typeof this.authService.saveCalendarTokens === "function") {
                    await this.authService.saveCalendarTokens(tokenData);
                    console.log("[LocalCollector] Google tokens saved to DB");
                }

                res.set("Content-Type", "text/html");
                res.send(`
                    <html>
                      <body style="font-family:sans-serif;text-align:center;padding-top:50px;">
                        <h2>✅ Google Calendar Connected!</h2>
                        <p>You can close this window and return to the app.</p>
                      </body>
                    </html>
                `);

                // Notify main process/UI
                this.emit("google-calendar-connected", tokenData);
            } catch (err) {
                console.error("[LocalCollector] Google auth error", err);
                res.status(500).send("Internal Server Error during OAuth");
            }
        });

        // ---------- WEBSOCKET SETUP ----------
        this.server = http.createServer(this.app);
        this.wss = new WSS({ noServer: true });

        this.server.on("upgrade", (request, socket, head) => {
            const u = new URL(request.url || "", `http://localhost`);
            const token = u.searchParams.get("token");
            if (!token) {
                socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
                socket.destroy();
                return;
            }
            try {
                const decoded = jwt.verify(token, JWT_SECRET_KEY) as any;
                this.wss.handleUpgrade(request, socket, head, (ws) => {
                    (ws as any).clientId = decoded.client;
                    this.wss.emit("connection", ws, request);
                });
            } catch {
                socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
                socket.destroy();
            }
        });

        this.wss.on("connection", (ws: WebSocket) => {
            ws.on("message", (msg) => {
                try {
                    const hb = JSON.parse(msg.toString());
                    (hb as any).clientId = (ws as any).clientId;
                    this.emit("extension-heartbeat", hb);
                } catch {
                    // ignore malformed
                }
            });
        });
    }

    start() {
        this.server.listen(this.port, () => {
            console.log(`[LocalCollector] Listening on port ${this.port}`);
            this.emit("listening", { port: this.port });
        });
    }

    stop() {
        this.wss.close();
        this.server.close();
    }
}
