// Routen für deployed Apps (Port-Registry)
const express = require('express');
const http = require('http');
const db = require('../models/db');
const auth = require('../middleware/auth');

const router = express.Router();

// Hilfsfunktion: Prüft ob ein Port tatsächlich erreichbar ist
function checkPort(port) {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}`, (res) => {
            resolve(true);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(1500, () => {
            req.destroy();
            resolve(false);
        });
    });
}

// Alle Routen nur für eingeloggte User
router.use(auth);

// GET /api/apps – Alle laufenden Apps anzeigen (mit Live-Port-Prüfung)
router.get('/', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, app_name, port, status, created_at FROM deployed_apps WHERE user_id = $1 ORDER BY created_at DESC',
            [req.user.userId]
        );

        // Jeden Port live prüfen und Status aktualisieren
        const appsWithStatus = await Promise.all(result.rows.map(async (app) => {
            const isRunning = await checkPort(app.port);
            const actualStatus = isRunning ? 'running' : 'stopped';

            // DB-Status bei Abweichung aktualisieren
            if (actualStatus !== app.status) {
                await db.query(
                    'UPDATE deployed_apps SET status = $1 WHERE id = $2',
                    [actualStatus, app.id]
                );
            }

            return { ...app, status: actualStatus };
        }));

        res.json(appsWithStatus);
    } catch (err) {
        console.error('Fehler beim Laden der Apps:', err.message);
        res.status(500).json({ error: 'Fehler beim Laden der Apps' });
    }
});

// GET /api/apps/next-port – Nächsten freien Port ermitteln
router.get('/next-port', async (req, res) => {
    try {
        const result = await db.query('SELECT MAX(port) as max_port FROM deployed_apps');
        const lastPort = result.rows[0].max_port || (parseInt(process.env.BASE_APP_PORT) - 1);
        res.json({ port: lastPort + 1 });
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Ermitteln des Ports' });
    }
});

module.exports = router;
