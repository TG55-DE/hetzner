// Deployment-Worker
// Verarbeitet Jobs aus der Queue: führt Claude Code aus und startet die fertige App
const { Worker, Queue } = require('bullmq');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const db = require('../models/db');
const { runClaudeCode } = require('./claude-code');
require('dotenv').config();

// Redis-Verbindung für die Queue
const redisConnection = {
    host: 'localhost',
    port: 6379,
};

// Queue-Instanz – hier landen neue Deployment-Aufträge
const deployQueue = new Queue('deployments', { connection: redisConnection });

// Hilfsfunktion: Nächsten freien Port aus der Datenbank holen
async function getNextPort() {
    const result = await db.query('SELECT MAX(port) as max_port FROM deployed_apps');
    const lastPort = result.rows[0].max_port || (parseInt(process.env.BASE_APP_PORT) - 1);
    return lastPort + 1;
}

// Worker startet und verarbeitet jeden Job
const worker = new Worker('deployments', async (job) => {
    const { appName, prompt, bildPfade = [], userId, conversationId } = job.data;
    const appPath = path.join(process.env.DEPLOYMENTS_PATH, appName);

    // Fortschritt an die PWA senden (via Job-Progress → WebSocket)
    const sendStatus = async (message) => {
        await job.updateProgress({ message, userId });
        console.log(`[${appName}] ${message}`);
    };

    try {
        // Schritt 1: Projektordner erstellen
        await sendStatus('📁 Erstelle Projektordner...');
        if (!fs.existsSync(appPath)) {
            fs.mkdirSync(appPath, { recursive: true });
        }

        // Schritt 2: Port reservieren
        const port = await getNextPort();
        await sendStatus(`🔌 Port ${port} reserviert`);

        // Schritt 3: Claude Code ausführen (via CLI, nicht API)
        await sendStatus('🤖 Claude Code schreibt den Code...');

        // Detaillierter Prompt für Claude Code
        // Wenn Bilder als Referenz mitgeschickt wurden: Hinweis an den Anfang stellen
        let bildReferenz = '';
        if (bildPfade.length > 0) {
            const bildListe = bildPfade.map(p => `  - ${p}`).join('\n');
            bildReferenz = `DESIGN-REFERENZ: Der User hat ${bildPfade.length === 1 ? 'einen Screenshot' : 'Screenshots'} als Vorlage mitgeschickt.\n` +
                `Lese ${bildPfade.length === 1 ? 'ihn' : 'sie'} mit dem Read-Tool und orientiere dich am Design:\n${bildListe}\n\n`;
            console.log(`[${appName}] Bild-Referenz wird mitgegeben: ${bildPfade.join(', ')}`);
        }

        const claudePrompt = `${bildReferenz}${prompt}

WICHTIG: Erstelle eine vollständige, lauffähige Web-App in diesem Ordner (${appPath}).
- Nutze Node.js + Express als Backend
- Starte die App auf Port ${port}
- Erstelle eine package.json mit einem "start"-Script
- Die App soll sofort mit "npm start" startbar sein
- Alle Kommentare im Code auf Deutsch
- Mobile-First Design (optimiert für iPhone)`;

        // Gesammelte Datei-Operationen für Status-Updates
        let erstellteDateien = [];

        await runClaudeCode(claudePrompt, (typ, daten) => {
            if (typ === 'tool' && (daten.name === 'Write' || daten.name === 'Edit')) {
                // Jede Datei-Operation als Fortschritt melden
                const dateiPfad = daten.input?.file_path || daten.input?.path || '';
                const kurzPfad = dateiPfad.replace(appPath, '').replace(/^\//, '');
                if (kurzPfad && !erstellteDateien.includes(kurzPfad)) {
                    erstellteDateien.push(kurzPfad);
                    // Asynchron Status senden (fire-and-forget im Worker)
                    sendStatus(`📝 ${daten.name === 'Write' ? 'Erstellt' : 'Bearbeitet'}: ${kurzPfad}`).catch(console.error);
                }
            }
        }, appPath, null, bildPfade);

        // Schritt 4: npm install in der neuen App
        await sendStatus('📦 Installiere Abhängigkeiten...');
        if (fs.existsSync(path.join(appPath, 'package.json'))) {
            execSync('npm install --production', {
                cwd: appPath,
                stdio: 'pipe',
                timeout: 120000,
            });
        }

        // Schritt 5: App als Hintergrundprozess starten
        await sendStatus(`🚀 Starte App auf Port ${port}...`);

        const appProcess = spawn('sudo', ['-u', process.env.WORKER_USER, 'npm', 'start'], {
            cwd: appPath,
            detached: true,
            stdio: 'ignore',
            env: { ...process.env, PORT: port.toString() },
        });
        appProcess.unref(); // Prozess läuft unabhängig vom Worker weiter

        // Schritt 6: App in Datenbank registrieren
        await db.query(
            `INSERT INTO deployed_apps (user_id, app_name, port, status, conversation_id) VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (app_name) DO UPDATE SET user_id = $1, port = $3, status = $4, conversation_id = $5`,
            [userId, appName, port, 'running', conversationId]
        );

        // Schritt 7: systemd-Service für Auto-Start nach Reboot registrieren
        await sendStatus('⚙️ Registriere automatischen Start...');
        registriereSystemdService(appName, appPath, port);

        const appUrl = `https://91.99.56.96:${port}`;
        await sendStatus(`✅ Fertig! Deine App ist live unter: ${appUrl}`);

        // Link-Nachricht in der Konversation speichern
        await db.query(
            'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
            [conversationId, 'system', `🎉 App "${appName}" erfolgreich deployed!\n\n🔗 [${appUrl}](${appUrl})\n\n📁 Erstellte Dateien: ${erstellteDateien.join(', ')}`]
        );

        return { success: true, url: appUrl, port, files: erstellteDateien };

    } catch (err) {
        console.error(`[${appName}] Fehler:`, err.message);
        await sendStatus(`❌ Fehler beim Deployment: ${err.message}`);

        // Aufräumen bei Fehler
        try {
            if (fs.existsSync(appPath)) {
                fs.rmSync(appPath, { recursive: true, force: true });
            }
        } catch (cleanupErr) {
            console.error('Aufräumen fehlgeschlagen:', cleanupErr.message);
        }

        throw err; // Job als fehlgeschlagen markieren
    }
}, { connection: redisConnection });

// systemd-Service für eine App erstellen (Auto-Start nach Reboot)
function registriereSystemdService(appName, appPath, port) {
    const serviceContent = `[Unit]
Description=CC Extension App: ${appName}
After=network.target

[Service]
Type=simple
User=${process.env.WORKER_USER || 'agent-worker'}
WorkingDirectory=${appPath}
ExecStart=/usr/local/bin/npm start
Environment=PORT=${port}
Restart=on-failure

[Install]
WantedBy=multi-user.target
`;

    const servicePath = `/etc/systemd/system/ccapp-${appName}.service`;
    try {
        fs.writeFileSync(servicePath, serviceContent);
        execSync(`systemctl daemon-reload && systemctl enable ccapp-${appName}`);
    } catch (err) {
        // Fehler ignorieren wenn kein sudo-Zugriff – App läuft trotzdem
        console.error('systemd-Registrierung fehlgeschlagen (kein sudo?):', err.message);
    }
}

// Worker-Ereignisse loggen
worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} (${job.data.appName}) abgeschlossen`);
});

worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job.id} (${job.data.appName}) fehlgeschlagen:`, err.message);
});

console.log('🔧 Deployment-Worker gestartet und wartet auf Jobs...');

module.exports = { deployQueue, worker };
