// CC Extension Backend – Hauptdatei
// Startet den Express-Server, verbindet alle Routen und den WebSocket
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { rateLimit } = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const conversationRoutes = require('./routes/conversations');
const appsRoutes = require('./routes/apps');
const transcribeRoutes = require('./routes/transcribe');
const { setupWebSocket } = require('./services/websocket');
const { claudeVerfuegbar } = require('./services/claude-code');
const db = require('./models/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Caddy läuft als Reverse Proxy – Express muss das wissen damit
// Rate Limiter die richtige Client-IP liest (kein ERR_ERL_UNEXPECTED_X_FORWARDED_FOR)
app.set('trust proxy', 1);

// Log-Ordner erstellen
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

// Logging-Hilfsfunktion
function log(message) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(path.join(logDir, 'backend.log'), line);
    console.log(message);
}

// Rate Limiter: max. 10 Anfragen pro Minute für API-Endpunkte
// Schützt vor Missbrauch und übermäßigen Claude Code Aufrufen
const apiRateLimiter = rateLimit({
    windowMs: 60 * 1000,    // 1 Minute
    max: 10,                 // max. 10 Anfragen pro Minute
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Zu viele Anfragen. Bitte warte eine Minute.' },
    // Auth-Endpunkte vom Chat-Limit ausnehmen (eigenes Limit unten)
    skip: (req) => req.path.startsWith('/api/auth'),
});

// Strengeres Rate Limit für Chat (Claude Code Aufrufe sind teuer)
const chatRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Zu viele Anfragen. Maximal 10 Prompts pro Minute erlaubt.' },
});

// Auth Rate Limit: max. 20 Versuche pro Minute (Schutz vor Brute-Force)
const authRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: 'Zu viele Login-Versuche. Bitte warte eine Minute.' },
});

// Middleware: Erlaubt Anfragen von der PWA
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Middleware: JSON-Anfragen parsen
app.use(express.json({ limit: '50mb' })); // 50MB für Bildanhänge

// Logging jeder Anfrage
app.use((req, res, next) => {
    log(`${req.method} ${req.path}`);
    next();
});

// Rate Limiter auf alle API-Routen anwenden
app.use('/api', apiRateLimiter);

// Routen einbinden
app.use('/api/auth', authRateLimiter, authRoutes);
app.use('/api/chat', chatRateLimiter, chatRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/apps', appsRoutes);
app.use('/api/transcribe', transcribeRoutes);

// Status-Endpunkt: Zeigt ob Server und Claude Code bereit sind
app.get('/api/status', async (req, res) => {
    const claudeOk = await claudeVerfuegbar();
    let dbOk = false;
    try {
        await db.query('SELECT 1');
        dbOk = true;
    } catch { /* ignorieren */ }

    res.json({
        server: 'ok',
        claudeCode: claudeOk,
        datenbank: dbOk,
        zeit: new Date().toISOString(),
        version: '2.0.0',
    });
});

// History-Endpunkt: Zeigt die letzten Prompts und Ergebnisse
// Erfordert Login (Token im Authorization-Header)
const auth = require('./middleware/auth');
app.get('/api/history', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT m.role, m.content, m.created_at, c.title as konversation
             FROM messages m
             JOIN conversations c ON c.id = m.conversation_id
             WHERE c.user_id = $1
             ORDER BY m.created_at DESC
             LIMIT 50`,
            [req.user.userId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Laden der History' });
    }
});

// Health-Check (kein Auth nötig, für Monitoring)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// PWA-Dateien ausliefern (der gebaute React-Code)
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// Alle anderen Routen zur index.html schicken (React Router)
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// HTTP-Server erstellen (nötig für WebSocket)
const server = http.createServer(app);

// WebSocket-Server starten
setupWebSocket(server);

// Server starten
server.listen(PORT, '0.0.0.0', () => {
    log(`CC Extension Backend läuft auf Port ${PORT}`);
    log(`API verfügbar unter: https://91.99.56.96/api`);
});

// Fehler-Handler: Unbehandelte Fehler loggen statt crashen
process.on('uncaughtException', (err) => {
    log(`KRITISCHER FEHLER: ${err.message}`);
    log(err.stack);
});

process.on('unhandledRejection', (reason) => {
    log(`Unbehandelte Promise-Ablehnung: ${reason}`);
});
