import express from 'express';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import http from 'http';
import WebSocket, { Server as WSS } from 'ws';
import jwt from 'jsonwebtoken';
import { EventEmitter } from 'events';

const DEFAULT_PORT = 47845;
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY!;

export class LocalCollectorServer extends EventEmitter {
    private app = express();
    private server: http.Server;
    private wss: WSS;
    private port: number;

    constructor(port = DEFAULT_PORT) {
        super();
        this.port = port;

        this.app.use(helmet());
        this.app.use(bodyParser.json({ limit: '200kb' }));

        // health
        this.app.get('/status', (_req, res) => res.json({ ok: true }));

        // endpoint to request ephemeral token (UX: from renderer after user authorizes extension)
        this.app.post('/token', (req, res) => {
            // require a signed request from renderer or a local confirm step
            // Here we assume the user authorized; create short-lived JWT
            const token = jwt.sign({ client: req.body.clientId || 'unknown' }, JWT_SECRET_KEY, { expiresIn: '1h' });
            res.json({ token });
        });

        // heartbeat endpoint for extensions
        this.app.post('/heartbeat', (req, res) => {
            const auth = req.headers['authorization'];
            if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'missing token' });
            const token = (auth as string).slice(7);

            try {
                const decoded = jwt.verify(token, JWT_SECRET_KEY) as any;
                const hb = req.body;
                // attach client info or other claims
                hb.source = hb.source || 'extension';
                hb.clientId = decoded.client;
                this.emit('extension-heartbeat', hb);
                return res.json({ ok: true });
            } catch (err) {
                return res.status(401).json({ error: 'invalid token' });
            }
        });

        this.server = http.createServer(this.app);

        this.wss = new WSS({ noServer: true });
        this.server.on('upgrade', (request, socket, head) => {
            // Basic upgrade auth via query ?token=...
            const u = new URL(request.url || '', `http://localhost`);
            const token = u.searchParams.get('token');
            if (!token) {
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
                return;
            }
            try {
                const decoded = jwt.verify(token, JWT_SECRET_KEY) as any;
                this.wss.handleUpgrade(request, socket, head, (ws) => {
                    (ws as any).clientId = decoded.client;
                    this.wss.emit('connection', ws, request);
                });
            } catch (err) {
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
            }
        });

        this.wss.on('connection', (ws: WebSocket) => {
            ws.on('message', (msg) => {
                try {
                    const hb = JSON.parse(msg.toString());
                    (hb as any).clientId = (ws as any).clientId;
                    this.emit('extension-heartbeat', hb);
                } catch (err) {
                    // ignore malformed
                }
            });
        });
    }

    start() {
        this.server.listen(this.port, () => {
            this.emit('listening', { port: this.port });
        });
    }

    stop() {
        this.wss.close();
        this.server.close();
    }
}
