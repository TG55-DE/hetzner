// Claude Service – Routing-Entscheidung
// Nutzt die Anthropic API nur noch für die schnelle Routing-Entscheidung
// (Chat vs. Deployment). Der eigentliche Chat läuft über Claude Code CLI.
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Erkennt ob eine Nachricht ein normaler Chat oder ein Deployment-Auftrag ist.
 * Nutzt die API für eine schnelle Klassifizierung (kein voller Claude Code Start).
 *
 * @returns {{ type: 'chat' | 'deploy', appName?: string }}
 */
async function routeMessage(userMessage) {
    const response = await client.messages.create({
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        max_tokens: 150,
        system: `Du bist ein Router. Entscheide ob die folgende Nachricht ein normaler Chat ist oder ein Deployment-Auftrag ist.
Antworte NUR mit JSON:
- Normaler Chat: {"type":"chat","reason":"kurze Begründung"}
- Deployment-Auftrag: {"type":"deploy","appName":"kurzer-app-name-ohne-leerzeichen-auf-deutsch","reason":"kurze Begründung"}

Beispiele für Deployment-Aufträge: "Baue mir eine Todo-Liste", "Erstelle einen Taschenrechner", "Mach eine Wetter-App", "Erstelle ein Memory Spiel"
Bilder allein oder Fragen zu Bildern sind IMMER ein normaler Chat.
Alles andere ist ein normaler Chat.`,
        messages: [{ role: 'user', content: userMessage }],
    });

    try {
        const text = response.content[0].text.trim();
        const result = JSON.parse(text);
        console.log(`[Routing] Entscheidung: ${result.type}${result.appName ? ` (${result.appName})` : ''} – ${result.reason || '–'}`);
        return result;
    } catch {
        // Im Zweifel: normaler Chat
        console.log('[Routing] JSON-Parsing fehlgeschlagen – Fallback auf chat');
        return { type: 'chat' };
    }
}

module.exports = { routeMessage };
