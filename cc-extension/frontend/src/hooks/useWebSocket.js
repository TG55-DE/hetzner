// WebSocket-Hook: Verwaltet die Live-Verbindung zum Backend
// Wechselt automatisch zwischen ws:// (HTTP) und wss:// (HTTPS)
import { useEffect, useRef, useCallback } from 'react';

export function useWebSocket(token, onMessage) {
    const wsRef = useRef(null);
    const reconnectTimer = useRef(null);
    const pingTimer = useRef(null);
    // Ref auf den aktuellen Callback – verhindert unnötige Neuverbindungen
    const onMessageRef = useRef(onMessage);
    useEffect(() => { onMessageRef.current = onMessage; });

    const connect = useCallback(() => {
        if (!token) return;

        // Automatisch das richtige Protokoll wählen
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('WebSocket verbunden');
            // Alle 25 Sekunden einen Ping senden – verhindert dass Caddy
            // die Verbindung wegen Inaktivität schließt
            pingTimer.current = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'ping' }));
                }
            }, 25000);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'pong') return; // Keepalive-Antwort ignorieren
                onMessageRef.current(data);
            } catch {
                console.error('WebSocket: Ungültige Nachricht');
            }
        };

        ws.onclose = () => {
            console.log('WebSocket getrennt – versuche neu zu verbinden...');
            clearInterval(pingTimer.current);
            reconnectTimer.current = setTimeout(connect, 3000);
        };

        ws.onerror = (err) => {
            console.error('WebSocket Fehler:', err);
        };
    }, [token]); // Nur token als Abhängigkeit – onMessage über Ref aktuell halten

    useEffect(() => {
        connect();
        return () => {
            clearTimeout(reconnectTimer.current);
            clearInterval(pingTimer.current);
            if (wsRef.current) wsRef.current.close();
        };
    }, [connect]);
}
