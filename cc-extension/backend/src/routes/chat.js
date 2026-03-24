// Chat-Route
// Empfängt Nachrichten, entscheidet ob Chat oder Deployment,
// und führt Chat-Prompts über Claude Code CLI aus (statt direkt über die API)
const express = require('express');
const db = require('../models/db');
const auth = require('../middleware/auth');
const { routeMessage } = require('../services/claude');
const { runClaudeCode, speichereAnhaenge } = require('../services/claude-code');
const { deployQueue } = require('../services/worker');

const router = express.Router();

// Alle Chat-Routen nur für eingeloggte User
router.use(auth);

// POST /api/chat – Nachricht senden
// Unterstützt Server-Sent Events (SSE) für Echtzeit-Streaming
router.post('/', async (req, res) => {
    const { message, conversationId, attachments } = req.body;

    // Logging: Attachments-Eingang prüfen
    if (attachments && attachments.length > 0) {
        console.log(`[Chat] ${attachments.length} Anhang/Anhänge empfangen:`,
            attachments.map(a => `${a.name} (${a.mimeType}, base64-Länge: ${a.base64?.length ?? 0})`).join(', '));
    }

    if (!message && (!attachments || attachments.length === 0)) {
        return res.status(400).json({ error: 'Nachricht oder Anhang fehlt' });
    }

    try {
        // Bilder VOR dem Routing speichern – so können BEIDE Pfade (Chat + Deployment)
        // die gespeicherten Dateipfade nutzen. Routing-Entscheidung basiert nur auf Text.
        const bildPfade = await speichereAnhaenge(attachments);

        // Gespräch laden oder neu anlegen
        let convId = conversationId;
        if (!convId) {
            const newConv = await db.query(
                'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING id',
                [req.user.userId, (message || 'Neues Gespräch').substring(0, 50)]
            );
            convId = newConv.rows[0].id;
        }

        // Nutzernachricht in der Datenbank speichern
        await db.query(
            'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
            [convId, 'user', message || '📎 Bild angehängt']
        );

        // Gespräch-Zeitstempel aktualisieren
        await db.query(
            'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
            [convId]
        );

        // Routing-Entscheidung: normaler Chat oder Deployment?
        // Wichtig: Nur den TEXT auswerten – Bilder beeinflussen die Entscheidung NICHT.
        // "Baue eine App" + Bild → Deploy (Bild dient als Design-Referenz)
        // "Was siehst du?" + Bild → Chat (Bild wird analysiert)
        const routingText = message?.trim() || (bildPfade.length > 0 ? 'Analysiere das Bild' : '');
        const routing = await routeMessage(routingText);
        console.log(`[Routing] "${routingText.substring(0, 60)}..." → ${routing.type}${routing.appName ? ` (App: ${routing.appName})` : ''}`);

        if (routing.type === 'deploy') {
            // ---- DEPLOYMENT-PFAD ----
            const appName = routing.appName.toLowerCase().replace(/[^a-z0-9-]/g, '-');

            // Job in die Queue einreihen – bildPfade mitsenden damit der Worker
            // das Bild als Design-Referenz in den Claude-Prompt einbauen kann
            const job = await deployQueue.add('deploy', {
                appName,
                prompt: message,
                bildPfade,
                userId: req.user.userId,
                conversationId: convId,
            });

            // Systemnachricht speichern
            const statusMsg = `🔧 Deployment gestartet für "${appName}" (Job ${job.id})\nClaude Code schreibt jetzt den Code – du siehst den Fortschritt hier im Chat.`;
            await db.query(
                'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
                [convId, 'system', statusMsg]
            );

            return res.json({
                type: 'deploy',
                jobId: job.id,
                appName,
                conversationId: convId,
                message: statusMsg,
            });

        } else {
            // ---- CHAT-PFAD: Claude Code CLI ausführen ----

            // SSE-Header SOFORT senden – KRITISCH für iOS Safari
            // Ohne flushHeaders() wartet iOS auf den ersten Datenchunk und bricht
            // nach ~60s ab ("Load failed"), weil der Header-Timeout überschritten wird.
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders(); // <-- sendet Header sofort, fetch() auf dem Client kann weitermachen

            // Hilfsfunktion: SSE-Event an den Client senden
            const sseSchicken = (typ, daten) => {
                if (!res.writableEnded) {
                    res.write(`data: ${JSON.stringify({ type: typ, ...daten })}\n\n`);
                }
            };

            // Keepalive: alle 15s einen SSE-Kommentar senden damit iOS die Verbindung
            // nicht als idle betrachtet und kappt (iOS killt stille Verbindungen nach ~60-120s)
            const keepaliveInterval = setInterval(() => {
                if (!res.writableEnded) {
                    res.write(': ka\n\n');
                }
            }, 15000);

            // AbortController: wenn der Client die Verbindung trennt, claude-Prozess sofort killen
            const abortController = new AbortController();
            req.on('close', () => abortController.abort());

            let vollstaendigerText = '';

            try {
                // Gesprächskontext aus der Datenbank laden (letzte 10 Nachrichten)
                const verlauf = await db.query(
                    `SELECT role, content FROM messages
                     WHERE conversation_id = $1 AND role IN ('user', 'assistant')
                     ORDER BY created_at DESC LIMIT 10`,
                    [convId]
                );

                // Kontext als Textpräambel aufbauen (älteste zuerst, ohne die aktuelle Anfrage)
                const nachrichten = verlauf.rows.reverse();
                let prompt = message || 'Analysiere die angehängten Bilder';

                if (nachrichten.length > 1) {
                    // Bisherige Nachrichten als Kontext voranstellen
                    const kontext = nachrichten
                        .slice(0, -1) // aktuelle Anfrage weglassen (schon am Ende)
                        .map(m => `${m.role === 'user' ? 'User' : 'Assistent'}: ${m.content}`)
                        .join('\n');
                    prompt = `Gesprächsverlauf:\n${kontext}\n\n---\n\nAktueller Auftrag:\n${prompt}`;
                }

                await runClaudeCode(prompt, (typ, daten) => {
                    if (typ === 'text') {
                        sseSchicken('chunk', { chunk: daten.text });
                        vollstaendigerText += daten.text;
                    } else if (typ === 'tool') {
                        sseSchicken('tool', { name: daten.name, input: daten.input });
                    } else if (typ === 'usage') {
                        sseSchicken('usage', daten);
                    } else if (typ === 'error') {
                        sseSchicken('error', { message: daten.message });
                    }
                }, undefined, abortController.signal, bildPfade);

            } catch (err) {
                // Abbruch durch Client-Disconnect nicht als Fehler melden
                if (!abortController.signal.aborted) {
                    sseSchicken('error', { message: `Claude Code Fehler: ${err.message}` });
                }
            } finally {
                clearInterval(keepaliveInterval);
            }

            // Antwort in der Datenbank speichern
            if (vollstaendigerText) {
                await db.query(
                    'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
                    [convId, 'assistant', vollstaendigerText]
                );
            }

            // Stream beenden (falls Verbindung noch offen)
            if (!res.writableEnded) {
                sseSchicken('done', { conversationId: convId });
                res.end();
            }
        }

    } catch (err) {
        console.error('Chat-Fehler:', err.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Fehler beim Verarbeiten der Nachricht' });
        }
    }
});

module.exports = router;
