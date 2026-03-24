// API-Service: Alle Anfragen ans Backend gehen durch diese Datei
// Relative Pfade funktionieren mit HTTP und HTTPS automatisch
const BASE_URL = '/api';

function getToken() {
    return localStorage.getItem('token');
}

function headers() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
    };
}

// ---- Auth ----

export async function register(email, password) {
    const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function login(email, password) {
    const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

// ---- Gespräche ----

export async function getConversations() {
    const res = await fetch(`${BASE_URL}/conversations`, { headers: headers() });
    if (!res.ok) throw new Error('Fehler beim Laden');
    return res.json();
}

export async function getMessages(conversationId) {
    const res = await fetch(`${BASE_URL}/conversations/${conversationId}/messages`, { headers: headers() });
    if (!res.ok) throw new Error('Fehler beim Laden');
    return res.json();
}

export async function deleteConversation(conversationId) {
    await fetch(`${BASE_URL}/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: headers(),
    });
}

// ---- Status ----

export async function getStatus() {
    const res = await fetch(`${BASE_URL}/status`, { headers: headers() });
    if (!res.ok) return null;
    return res.json();
}

// ---- Chat (mit Streaming) ----
// Callbacks:
//   onChunk(text)           – Textchunk von Claude
//   onTool(name, input)     – Datei-Operation oder Befehl
//   onUsage(data)           – Token-Verbrauch und Kosten
//   onDone(data)            – Abgeschlossen (enthält conversationId)
export async function sendMessage(message, conversationId, model, attachments, onChunk, onTool, onUsage, onDone) {
    const res = await fetch(`${BASE_URL}/chat`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ message, conversationId, model, attachments }),
    });

    if (!res.ok) throw new Error((await res.json()).error);

    const contentType = res.headers.get('Content-Type') || '';

    // Deployment-Antwort (kein Stream, direkt JSON)
    if (contentType.includes('application/json')) {
        const data = await res.json();
        onDone(data);
        return;
    }

    // SSE-Stream lesen mit korrektem Zeilenpuffer
    // (TCP-Chunks können mitten in einer SSE-Zeile enden – buffer akkumuliert das)
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        // Letzte (möglicherweise unvollständige) Zeile im Puffer behalten
        sseBuffer = lines.pop() ?? '';

        for (const line of lines) {
            // SSE-Kommentare (keepalive) und Leerzeilen überspringen
            if (!line.startsWith('data: ')) continue;
            try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'chunk' && data.chunk) {
                    onChunk(data.chunk);
                } else if (data.type === 'tool') {
                    onTool && onTool(data.name, data.input);
                } else if (data.type === 'usage') {
                    onUsage && onUsage(data);
                } else if (data.type === 'done') {
                    onDone(data);
                } else if (data.type === 'error') {
                    throw new Error(data.message);
                }
            } catch (e) {
                // Nur echte Fehler weiterwerfen, keine kaputten JSON-Fragmente
                if (e.message && !e.message.includes('JSON')) {
                    throw e;
                }
            }
        }
    }
}

// ---- Apps ----

export async function getApps() {
    const res = await fetch(`${BASE_URL}/apps`, { headers: headers() });
    if (!res.ok) throw new Error('Fehler beim Laden');
    return res.json();
}
