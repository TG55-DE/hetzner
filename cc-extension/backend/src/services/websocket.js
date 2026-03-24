// WebSocket-Service
// Hält Verbindungen zur PWA offen und sendet Echtzeit-Updates während Deployments laufen
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { QueueEvents } = require('bullmq');
require('dotenv').config();

// Verbindungen nach userId speichern
const connections = new Map();

// Redis-Verbindung für Queue-Events
const redisConnection = { host: 'localhost', port: 6379 };

// Auf Events aus der Deployment-Queue hören
const queueEvents = new QueueEvents('deployments', { connection: redisConnection });

// WebSocket-Server an einen bestehenden HTTP-Server anhängen
function setupWebSocket(server) {
    const wss = new WebSocket.Server({ server, path: '/ws' });

    wss.on('connection', (ws, req) => {
        // Token aus der URL lesen (z.B. /ws?token=...)
        const url = new URL(req.url, 'http://localhost');
        const token = url.searchParams.get('token');

        if (!token) {
            ws.close(4001, 'Kein Token');
            return;
        }

        let userId;
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.userId;
        } catch {
            ws.close(4002, 'Token ungültig');
            return;
        }

        // Verbindung speichern
        connections.set(userId, ws);
        console.log(`WebSocket: User ${userId} verbunden`);

        // Verbindung bei Trennung aufräumen
        ws.on('close', () => {
            connections.delete(userId);
            console.log(`WebSocket: User ${userId} getrennt`);
        });

        // Ping-Nachrichten vom Frontend mit Pong beantworten (Keepalive durch Caddy)
        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data);
                if (msg.type === 'ping') {
                    ws.send(JSON.stringify({ type: 'pong' }));
                }
            } catch { /* ignorieren */ }
        });

        // Bestätigung senden
        ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket verbunden' }));
    });

    // Fortschritts-Updates aus der Queue an den richtigen User weiterleiten
    queueEvents.on('progress', ({ jobId, data }) => {
        // Daten: { userId, message }
        if (data && data.userId && connections.has(data.userId)) {
            const ws = connections.get(data.userId);
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'deploy_progress',
                    jobId,
                    message: data.message,
                }));
            }
        }
    });

    // Wenn ein Deployment fertig ist
    queueEvents.on('completed', ({ jobId, returnvalue }) => {
        // Alle verbundenen User über Abschluss informieren
        connections.forEach((ws, userId) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'deploy_completed',
                    jobId,
                    result: returnvalue,
                }));
            }
        });
    });

    // Wenn ein Deployment fehlschlug
    queueEvents.on('failed', ({ jobId, failedReason }) => {
        connections.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'deploy_failed',
                    jobId,
                    error: failedReason,
                }));
            }
        });
    });

    console.log('WebSocket-Server gestartet auf /ws');
}

// Nachricht direkt an einen User senden (von anderen Services nutzbar)
function sendToUser(userId, data) {
    const ws = connections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

module.exports = { setupWebSocket, sendToUser };
