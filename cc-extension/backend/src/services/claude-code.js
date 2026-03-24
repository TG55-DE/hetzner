// Claude Code Runner Service
// Führt Prompts über die lokale claude-CLI aus statt direkt über die API
// Das ermöglicht echte Dateioperationen auf dem VPS
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Temporärer Ordner für hochgeladene Bilder
const UPLOAD_DIR = '/tmp/cc-uploads';

// Upload-Ordner erstellen falls nicht vorhanden
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Cleanup-Job: alle 10 Minuten Bilder löschen die älter als 1 Stunde sind
setInterval(() => {
    try {
        const jetzt = Date.now();
        const dateien = fs.readdirSync(UPLOAD_DIR);
        for (const datei of dateien) {
            const dateiPfad = path.join(UPLOAD_DIR, datei);
            const stat = fs.statSync(dateiPfad);
            // Dateien löschen die älter als 1 Stunde (3600000ms) sind
            if (jetzt - stat.mtimeMs > 3600000) {
                fs.unlinkSync(dateiPfad);
                console.log(`[Cleanup] Temporäres Bild gelöscht: ${datei}`);
            }
        }
    } catch (err) {
        console.error('[Cleanup] Fehler beim Aufräumen:', err.message);
    }
}, 10 * 60 * 1000); // alle 10 Minuten

// Pfad zur Claude Code CLI (wird beim Start gesetzt)
const CLAUDE_PATH = process.env.CLAUDE_PATH || '/home/timo_hahn/.local/bin/claude';

// Standard-Arbeitsverzeichnis für allgemeine Prompts
const DEFAULT_WORK_DIR = process.env.CLAUDE_WORK_DIR || '/home/timo_hahn/Timos_CC_Projekte';

/**
 * Speichert Bild-Anhänge (base64) als temporäre Dateien auf dem VPS.
 * Gibt die Dateipfade zurück – funktioniert für Chat- und Deployment-Pfad.
 *
 * @param {Array} attachments - Bilder als [{name, base64, mimeType}]
 * @returns {Promise<string[]>} - Absolute Dateipfade der gespeicherten Bilder
 */
async function speichereAnhaenge(attachments = []) {
    const bildPfade = [];
    if (!attachments || attachments.length === 0) return bildPfade;

    console.log(`[Upload] ${attachments.length} Anhang/Anhänge werden gespeichert`);
    for (const anhang of attachments) {
        if (!anhang.base64 || anhang.base64.length === 0) {
            console.error(`[Upload] Anhang ${anhang.name} hat keinen base64-Inhalt – übersprungen`);
            continue;
        }
        // jpeg → jpg normalisieren damit Claude die Datei sicher als Bild erkennt
        let erweiterung = (anhang.mimeType?.split('/')[1] || 'jpg').toLowerCase();
        if (erweiterung === 'jpeg') erweiterung = 'jpg';
        const dateiname = `bild-${Date.now()}-${Math.random().toString(36).slice(2)}.${erweiterung}`;
        const dateiPfad = path.join(UPLOAD_DIR, dateiname);
        try {
            const puffer = Buffer.from(anhang.base64, 'base64');
            fs.writeFileSync(dateiPfad, puffer);
            const stat = fs.statSync(dateiPfad);
            console.log(`[Upload] Bild gespeichert und verifiziert: ${dateiPfad} (${stat.size} Bytes, MimeType: ${anhang.mimeType})`);
            bildPfade.push(dateiPfad);
        } catch (err) {
            console.error(`[Upload] Fehler beim Speichern von ${anhang.name}:`, err.message);
        }
    }
    return bildPfade;
}

/**
 * Führt einen Prompt über die Claude Code CLI aus und streamt die Ergebnisse.
 *
 * Events die über onEvent gemeldet werden:
 *   - 'text'  : { text: string }                       – Textausgabe von Claude
 *   - 'tool'  : { name: string, input: object }        – Datei-Operation oder Befehl
 *   - 'usage' : { inputTokens, outputTokens, cacheReadTokens, totalCostUsd }
 *   - 'done'  : { result: string }                     – Abgeschlossen
 *   - 'error' : { message: string }                    – Fehler
 *
 * @param {string} prompt       - Der Prompt für Claude Code
 * @param {function} onEvent   - Callback: (type, data) => void
 * @param {string} cwd         - Arbeitsverzeichnis (optional, Standard: hetzner-Ordner)
 * @param {AbortSignal} signal  - Zum Abbrechen bei Client-Disconnect
 * @param {string[]} bildPfade  - Bereits gespeicherte Bilddateipfade (von speichereAnhaenge)
 * @returns {Promise<string>}   - Der vollständige Textinhalt der Antwort
 */
async function runClaudeCode(prompt, onEvent, cwd = DEFAULT_WORK_DIR, signal = null, bildPfade = []) {
    let erweiterterPrompt = prompt;

    // Bild-Anweisung an den ANFANG des Prompts stellen damit Claude die Bilder
    // ZUERST liest bevor er die Frage beantwortet
    if (bildPfade && bildPfade.length > 0) {
        const bildAnzahl = bildPfade.length;
        const bildListe = bildPfade.join('\n');
        const bildAnweisung =
            `WICHTIG – PFLICHTSCHRITT VOR JEDER ANTWORT:\n` +
            `Du hast ${bildAnzahl === 1 ? 'ein Bild' : `${bildAnzahl} Bilder`} erhalten.\n` +
            `Lese ${bildAnzahl === 1 ? 'diese Datei' : 'alle diese Dateien'} JETZT mit dem Read-Tool und analysiere ${bildAnzahl === 1 ? 'den Inhalt' : 'den Inhalt jeder Datei'}:\n` +
            `${bildListe}\n\n` +
            `Nachdem du ${bildAnzahl === 1 ? 'das Bild gelesen hast' : 'alle Bilder gelesen hast'}, beantworte die folgende Anfrage:\n\n`;
        erweiterterPrompt = bildAnweisung + erweiterterPrompt;
        console.log(`[Upload] Prompt erweitert mit Bild-Anweisung für ${bildAnzahl} Datei(en)`);
    }

    return new Promise((resolve, reject) => {
        // System-Prompt für Bilder: zuverlässiger als Anweisung im User-Prompt,
        // weil der System-Prompt höhere Autorität hat und Claude sicherer zum
        // Tool-Einsatz bewegt.
        const args = [
            '--print',                        // Nicht-interaktiver Modus
            '--output-format', 'stream-json', // JSON-Events streamen
            '--verbose',                       // Tool-Aufrufe im Stream einschließen
            '--dangerously-skip-permissions', // Keine Rückfragen (Server-Betrieb)
        ];

        // Wenn Bilder hochgeladen wurden: System-Prompt hinzufügen der Claude
        // explizit zum Lesen der Dateien mit dem Read-Tool anweist.
        // --append-system-prompt bewahrt den Standard-System-Prompt (inkl. Tool-Definitionen)
        // und ergänzt nur die Bild-Anweisung.
        if (bildPfade.length > 0) {
            const bildPfadListe = bildPfade.join(', ');
            args.push(
                '--append-system-prompt',
                `CRITICAL INSTRUCTION: The user has attached image file(s) to this message. ` +
                `You MUST use the Read tool to read each image file BEFORE responding. ` +
                `The image files are stored at: ${bildPfadListe}. ` +
                `Read ALL listed image files with the Read tool first, then answer the user's question based on what you see.`
            );
        }

        args.push(erweiterterPrompt);

        const child = spawn(CLAUDE_PATH, args, {
            cwd,
            // KRITISCH: stdin explizit auf 'ignore' setzen!
            // Ohne das erbt claude den stdin des Node.js-Prozesses (PM2-Daemon).
            // Claude-Code liest dann auf stdin und blockiert, weil kein TTY vorhanden ist.
            // Das ist der Grund warum Anfragen im Backend hingen ohne jemals zu antworten.
            stdio: ['ignore', 'pipe', 'pipe'],
            env: {
                ...process.env,
                HOME: '/home/timo_hahn',
                PATH: `/home/timo_hahn/.local/bin:${process.env.PATH}`,
            },
        });

        let aborted = false;

        // AbortSignal: wenn der Client die Verbindung trennt, Prozess sofort beenden
        if (signal) {
            signal.addEventListener('abort', () => {
                aborted = true;
                try { child.kill('SIGTERM'); } catch { /* ignorieren */ }
                // Kurz warten, dann hart beenden falls noch läuft
                setTimeout(() => {
                    try { child.kill('SIGKILL'); } catch { /* ignorieren */ }
                }, 2000);
                resolve(''); // Kein Fehler – Client hat bewusst abgebrochen
            }, { once: true });
        }

        let buffer = '';
        let fullText = '';

        // stdout: NDJSON-Zeilen verarbeiten
        child.stdout.on('data', (data) => {
            if (aborted) return;
            buffer += data.toString();
            const lines = buffer.split('\n');
            // Letzte (möglicherweise unvollständige) Zeile zurückhalten
            buffer = lines.pop();

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const event = JSON.parse(line);
                    verarbeiteEvent(event, onEvent, (text) => { fullText += text; });
                } catch {
                    // Nicht-JSON-Zeilen ignorieren (z.B. Warnmeldungen)
                }
            }
        });

        // stderr: Fehler loggen (nicht an den Client senden)
        child.stderr.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg) console.error('[Claude Code stderr]', msg);
        });

        // Prozess beendet
        child.on('close', (code) => {
            if (aborted) return; // Client hat abgebrochen – kein weiteres Handling

            // Eventuell verbliebenen Puffer verarbeiten
            if (buffer.trim()) {
                try {
                    const event = JSON.parse(buffer);
                    verarbeiteEvent(event, onEvent, (text) => { fullText += text; });
                } catch { /* ignorieren */ }
            }

            // Temporäre Bilddateien sofort löschen (nicht erst beim Cleanup-Job warten)
            for (const dateiPfad of bildPfade) {
                try {
                    fs.unlinkSync(dateiPfad);
                } catch { /* ignorieren falls schon weg */ }
            }

            if (code === 0) {
                resolve(fullText);
            } else {
                const err = new Error(`Claude Code beendet mit Exit-Code ${code}`);
                onEvent('error', { message: err.message });
                reject(err);
            }
        });

        // Startfehler (z.B. CLI nicht gefunden)
        child.on('error', (err) => {
            if (aborted) return;
            const msg = `Claude Code konnte nicht gestartet werden: ${err.message}`;
            onEvent('error', { message: msg });
            reject(new Error(msg));
        });
    });
}

// Verarbeitet ein einzelnes stream-json Event und leitet es weiter
function verarbeiteEvent(event, onEvent, appendText) {
    if (event.type === 'assistant') {
        // Inhalt der Assistent-Nachricht durchgehen
        const content = event.message?.content || [];
        for (const block of content) {
            if (block.type === 'text' && block.text) {
                // Textblock: sofort an den Client weiterschicken
                onEvent('text', { text: block.text });
                appendText(block.text);
            } else if (block.type === 'tool_use') {
                // Datei-Operation oder Befehl
                onEvent('tool', {
                    name: block.name,
                    input: block.input || {},
                });
            }
        }
    } else if (event.type === 'result') {
        // Abschluss-Event mit Token-Verbrauch
        const usage = event.usage || {};
        onEvent('usage', {
            inputTokens:      usage.input_tokens                  || 0,
            outputTokens:     usage.output_tokens                 || 0,
            cacheReadTokens:  usage.cache_read_input_tokens       || 0,
            cacheWriteTokens: usage.cache_creation_input_tokens   || 0,
            totalCostUsd:     event.total_cost_usd                || null,
        });
        onEvent('done', { result: event.result || '' });
    }
}

// Prüft ob die Claude Code CLI verfügbar ist
async function claudeVerfuegbar() {
    return new Promise((resolve) => {
        const child = spawn(CLAUDE_PATH, ['--version'], {
            env: { ...process.env, HOME: '/home/timo_hahn' },
        });
        child.on('close', (code) => resolve(code === 0));
        child.on('error', () => resolve(false));
    });
}

module.exports = { runClaudeCode, speichereAnhaenge, claudeVerfuegbar, DEFAULT_WORK_DIR };
