// Haupt-Chat-Seite mit Seitenleiste, Nachrichten und Eingabe
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import {
    getConversations, getMessages, sendMessage, deleteConversation
} from '../services/api';
import MessageBubble from '../components/MessageBubble';
import './ChatPage.css';

// SVG Burger-Menü-Icon (3 horizontale Linien)
function MenuIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
    );
}

// SVG Grid-Icon für "Meine Apps" (4 leere Quadrate)
function AppsGridIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
        </svg>
    );
}

// SVG Mikrofon-Icon
function MicIcon({ active }) {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="12" rx="3" fill={active ? '#ef4444' : 'none'} stroke={active ? '#ef4444' : 'currentColor'} />
            <path d="M19 10a7 7 0 0 1-14 0" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="8" y1="22" x2="16" y2="22" />
        </svg>
    );
}

// SVG Stop-Icon für Aufnahme-Stopp
function StopIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <rect x="5" y="5" width="14" height="14" rx="2" />
        </svg>
    );
}

// SVG Büroklammer-Icon für Dateianhänge
function AttachIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
    );
}

// SVG Expand-Icon (Pfeile nach außen) – öffnet Vollbild-Eingabe
function ExpandIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6" />
            <path d="M9 21H3v-6" />
            <path d="M21 3l-7 7" />
            <path d="M3 21l7-7" />
        </svg>
    );
}

// SVG Collapse-Icon (Pfeile nach innen) – schließt Vollbild-Eingabe
function CollapseIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 14h6v6" />
            <path d="M20 10h-6V4" />
            <path d="M14 10l7-7" />
            <path d="M3 21l7-7" />
        </svg>
    );
}

// Tool-Namen auf verständliche Deutsche Bezeichnungen mappen
const TOOL_BEZEICHNUNGEN = {
    Write:        { emoji: '📝', text: 'Datei erstellt' },
    Edit:         { emoji: '✏️', text: 'Datei bearbeitet' },
    Read:         { emoji: '📖', text: 'Datei gelesen' },
    Bash:         { emoji: '⚡', text: 'Befehl ausgeführt' },
    MultiEdit:    { emoji: '✏️', text: 'Dateien bearbeitet' },
    TodoWrite:    { emoji: '📋', text: 'Aufgaben aktualisiert' },
    WebFetch:     { emoji: '🌐', text: 'Webseite abgerufen' },
    WebSearch:    { emoji: '🔍', text: 'Websuche durchgeführt' },
    Glob:         { emoji: '🔎', text: 'Dateien gesucht' },
    Grep:         { emoji: '🔍', text: 'Code durchsucht' },
};

// Kosten-Kalkulation für claude-sonnet-4-6
function berechneKosten(inputTokens, outputTokens, cacheReadTokens = 0) {
    const INPUT_PREIS  = 0.000003;   // $3 / 1M Token
    const OUTPUT_PREIS = 0.000015;   // $15 / 1M Token
    const CACHE_PREIS  = 0.0000003;  // $0.30 / 1M Token
    return (inputTokens * INPUT_PREIS) + (outputTokens * OUTPUT_PREIS) + (cacheReadTokens * CACHE_PREIS);
}

export default function ChatPage({ selectedModel }) {
    const { token, email, logout } = useAuth();
    const navigate = useNavigate();

    // Gespräche in der Seitenleiste
    const [conversations, setConversations] = useState([]);
    const [activeConvId, setActiveConvId] = useState(null);

    // Nachrichten im aktiven Gespräch
    const [messages, setMessages] = useState([]);
    const [streamingMessage, setStreamingMessage] = useState('');

    // Aktuelle Tool-Events (Datei-Operationen) während einer Antwort
    const [aktuelleTools, setAktuelleTools] = useState([]);

    // Token-Verbrauch der letzten Antwort
    const [letzteUsage, setLetzteUsage] = useState(null);

    // Eingabe
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [recording, setRecording] = useState(false);

    // Dateianhänge: Array von { name, base64, mimeType, previewUrl }
    const [attachments, setAttachments] = useState([]);

    // Seitenleiste
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Vollbild-Eingabe
    const [inputExpanded, setInputExpanded] = useState(false);

    // Overflow-Erkennung: true wenn Textarea ihre Max-Höhe erreicht hat und scrollen müsste
    const [inputOverflowing, setInputOverflowing] = useState(false);

    // Long-Press für Gesprächs-Löschen
    const [longPressConvId, setLongPressConvId] = useState(null);
    const longPressTimerRef = useRef(null);

    // Offline-Erkennung
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const fileInputRef = useRef(null);
    // Streaming-Text-Ref für den onDone-Callback
    const streamingRef = useRef('');

    // Sprachaufnahme-Refs – alle Event-Listener sauber aufräumen
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const mediaStreamRef = useRef(null);
    // recognitionRef wird nicht mehr benötigt (Whisper ersetzt Web Speech API)
    const animFrameRef = useRef(null);
    const barsRef = useRef([null, null, null, null, null]);
    // Speichert den Input-Text der vor der Aufnahme da war
    const inputBeforeRecordingRef = useRef('');

    useEffect(() => {
        loadConversations();

        // Online/Offline-Status überwachen
        const onOnline  = () => setIsOnline(true);
        const onOffline = () => setIsOnline(false);
        window.addEventListener('online',  onOnline);
        window.addEventListener('offline', onOffline);
        return () => {
            window.removeEventListener('online',  onOnline);
            window.removeEventListener('offline', onOffline);
        };
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingMessage]);

    // WebSocket-Nachrichten empfangen (Deployment-Updates)
    const handleWsMessage = useCallback((data) => {
        if (data.type === 'deploy_progress') {
            setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'system' && last?.isLive) {
                    return [...prev.slice(0, -1), { ...last, content: data.message }];
                }
                return [...prev, { role: 'system', content: data.message, isLive: true }];
            });
        }
        if (data.type === 'deploy_completed') {
            setMessages(prev => [
                ...prev,
                { role: 'system', content: `✅ ${data.result?.url ? `App live unter: ${data.result.url}` : 'Deployment abgeschlossen!'}` }
            ]);
            loadConversations();
        }
        if (data.type === 'deploy_failed') {
            setMessages(prev => [
                ...prev,
                { role: 'system', content: `❌ Fehler beim Deployment: ${data.error}` }
            ]);
        }
    }, []);

    useWebSocket(token, handleWsMessage);

    async function loadConversations() {
        try {
            const data = await getConversations();
            setConversations(data);
        } catch (err) {
            console.error('Gespräche laden fehlgeschlagen:', err);
        }
    }

    async function openConversation(convId) {
        setActiveConvId(convId);
        setSidebarOpen(false);
        try {
            const data = await getMessages(convId);
            setMessages(data);
        } catch (err) {
            console.error('Nachrichten laden fehlgeschlagen:', err);
        }
    }

    function newConversation() {
        setActiveConvId(null);
        setMessages([]);
        setAttachments([]);
        setAktuelleTools([]);
        setLetzteUsage(null);
        setSidebarOpen(false);
        inputRef.current?.focus();
    }

    async function handleDeleteConversation(e, convId) {
        e.stopPropagation();
        await deleteConversation(convId);
        if (activeConvId === convId) newConversation();
        loadConversations();
    }

    // Bild auswählen und als base64 einlesen
    function handleAttachClick() {
        fileInputRef.current?.click();
    }

    async function handleFileChange(e) {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const newAttachments = await Promise.all(files.map(file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const base64 = reader.result.split(',')[1];
                    resolve({
                        name: file.name,
                        base64,
                        mimeType: file.type,
                        previewUrl: reader.result,
                    });
                };
                reader.readAsDataURL(file);
            });
        }));

        setAttachments(prev => [...prev, ...newAttachments]);
        e.target.value = '';
    }

    function removeAttachment(index) {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    }

    async function handleSend() {
        if ((!input.trim() && attachments.length === 0) || loading) return;
        if (!isOnline) return;

        const userMessage = input.trim();
        const currentAttachments = [...attachments];
        setInput('');
        // Textarea-Höhe nach dem Absenden zurücksetzen (nur im Normal-Modus)
        if (inputRef.current && !inputExpanded) inputRef.current.style.height = 'auto';
        setAttachments([]);
        setLoading(true);
        setAktuelleTools([]);
        setLetzteUsage(null);
        streamingRef.current = '';

        // Nutzernachricht sofort anzeigen
        setMessages(prev => [...prev, {
            role: 'user',
            content: userMessage || '📎 Bild angehängt',
            attachments: currentAttachments.map(a => a.previewUrl),
        }]);
        setStreamingMessage('');

        try {
            await sendMessage(
                userMessage,
                activeConvId,
                selectedModel,
                currentAttachments,
                // onChunk: Textchunk empfangen
                (chunk) => {
                    streamingRef.current += chunk;
                    setStreamingMessage(streamingRef.current);
                },
                // onTool: Datei-Operation empfangen
                (name, input) => {
                    const bezeichnung = TOOL_BEZEICHNUNGEN[name] || { emoji: '🔧', text: name };
                    const dateiPfad = input?.file_path || input?.path || input?.command || '';
                    const kurzPfad = dateiPfad.replace('/home/timo_hahn/Timos_CC_Projekte/', '').replace(/^hetzner\//, '');
                    setAktuelleTools(prev => [
                        ...prev,
                        { emoji: bezeichnung.emoji, text: bezeichnung.text, pfad: kurzPfad }
                    ]);
                },
                // onUsage: Token-Verbrauch empfangen
                (usage) => {
                    const kosten = usage.totalCostUsd
                        ? usage.totalCostUsd
                        : berechneKosten(usage.inputTokens, usage.outputTokens, usage.cacheReadTokens);
                    setLetzteUsage({ ...usage, berechneteKosten: kosten });
                },
                // onDone: Abgeschlossen
                (data) => {
                    if (data.conversationId) setActiveConvId(data.conversationId);
                    if (data.message) {
                        // Deployment-Antwort
                        setMessages(prev => [...prev, { role: 'system', content: data.message }]);
                    } else {
                        // Chat-Antwort: gestreamten Text als Nachricht speichern
                        const finalText = streamingRef.current;
                        setMessages(prev => [...prev, { role: 'assistant', content: finalText }]);
                    }
                    setStreamingMessage('');
                    streamingRef.current = '';
                    loadConversations();
                }
            );
        } catch (err) {
            setMessages(prev => [...prev, { role: 'system', content: `❌ Fehler: ${err.message}` }]);
            setStreamingMessage('');
            streamingRef.current = '';
        } finally {
            setLoading(false);
        }
    }

    function handleKeyDown(e) {
        // Enter macht nur Zeilenumbruch – Senden nur per Button
        // (kein spezielles Handling nötig, Textarea-Standard-Verhalten)
    }

    // Textarea-Höhe bei jeder input-Änderung anpassen – im Vollbild per CSS gesteuert
    // Außerdem: Overflow-Zustand erkennen (scrollHeight > 120px → Expand-Button einblenden)
    useEffect(() => {
        if (inputRef.current) {
            if (!inputExpanded) {
                inputRef.current.style.height = 'auto';
                const neueHoehe = Math.min(inputRef.current.scrollHeight, 120);
                inputRef.current.style.height = neueHoehe + 'px';
                // Doppelpfeil nur zeigen wenn Inhalt die Max-Höhe überschreitet
                setInputOverflowing(inputRef.current.scrollHeight > 120);
            } else {
                inputRef.current.style.height = '';
                setInputOverflowing(false);
            }
        }
    }, [input, inputExpanded]);

    // Textarea automatisch in der Höhe anpassen (1 Zeile bis max. 120px)
    function handleInputChange(e) {
        setInput(e.target.value);
    }

    // Alle Aufnahme-Ressourcen sauber aufräumen
    // Ref für den MediaRecorder (Whisper-Variante)
    const mediaRecorderRef = useRef(null);

    function stopRecording() {
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(t => t.stop());
            mediaStreamRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => {});
            audioContextRef.current = null;
        }
        analyserRef.current = null;
        setRecording(false);
    }

    // Sprachaufnahme mit OpenAI Whisper (serverseitig)
    async function handleVoice() {
        // Zweiter Klick = Aufnahme stoppen und an Whisper senden
        if (recording) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop(); // löst onstop aus → sendet Audio
            }
            return;
        }

        try {
            // Mikrofon-Zugriff anfordern
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            // Web Audio API für Waveform-Visualisierung
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const audioContext = new AudioCtx();
            audioContextRef.current = audioContext;
            const analyser = audioContext.createAnalyser();
            analyserRef.current = analyser;
            analyser.fftSize = 32;
            audioContext.createMediaStreamSource(stream).connect(analyser);

            // Aktuellen Input-Text merken, damit wir später dranhängen können
            inputBeforeRecordingRef.current = input;
            setRecording(true);

            // Waveform-Animation via requestAnimationFrame
            const draw = () => {
                const data = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(data);
                barsRef.current.forEach((bar, i) => {
                    if (!bar) return;
                    const val = data[Math.floor(i * data.length / barsRef.current.length)] / 255;
                    bar.style.height = `${4 + val * 28}px`;
                });
                animFrameRef.current = requestAnimationFrame(draw);
            };
            draw();

            // MediaRecorder starten – nimmt Audio auf und sammelt Chunks
            const chunks = [];
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = async () => {
                // Aufnahme beenden und Ressourcen aufräumen
                stopRecording();

                if (chunks.length === 0) return;

                // Audio-Blob erstellen und an Whisper senden
                const mimeType = recorder.mimeType || 'audio/webm';
                const blob = new Blob(chunks, { type: mimeType });

                const formData = new FormData();
                formData.append('audio', blob, 'aufnahme.webm');

                try {
                    const token = localStorage.getItem('token');
                    const response = await fetch('/api/transcribe', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` },
                        body: formData,
                    });

                    if (!response.ok) {
                        const err = await response.json().catch(() => ({}));
                        throw new Error(err.error || `HTTP ${response.status}`);
                    }

                    const data = await response.json();
                    const transkription = (data.text || '').trim();

                    if (transkription) {
                        const prefix = inputBeforeRecordingRef.current;
                        setInput(prefix + (prefix ? ' ' : '') + transkription);
                    }
                } catch (err) {
                    setMessages(prev => [...prev, {
                        role: 'system',
                        content: `Transkription fehlgeschlagen: ${err.message}`
                    }]);
                }
            };

            recorder.start();
        } catch {
            setMessages(prev => [...prev, {
                role: 'system',
                content: 'Mikrofon-Zugriff verweigert. Bitte in den iPhone-Einstellungen erlauben.'
            }]);
            stopRecording();
        }
    }

    // Long-Press-Erkennung für Gesprächs-Löschen (500ms gedrückt halten)
    function handleConvTouchStart(convId) {
        longPressTimerRef.current = setTimeout(() => {
            setLongPressConvId(convId);
        }, 500);
    }

    function handleConvTouchEnd() {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    }

    function handleConvClick(convId) {
        // Nur öffnen wenn kein Long-Press aktiv
        if (longPressConvId) {
            setLongPressConvId(null);
            return;
        }
        openConversation(convId);
    }

    const canSend = (input.trim() || attachments.length > 0) && !loading && isOnline;

    return (
        <div className="chat-page">
            {/* Offline-Banner */}
            {!isOnline && (
                <div className="offline-banner">
                    📡 Keine Verbindung zum Server – bitte Internet-Verbindung prüfen
                </div>
            )}

            {/* Seitenleiste */}
            <div className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
                <div className="sidebar-header">
                    <h2>Gespräche</h2>
                    <button className="btn-icon" onClick={() => setSidebarOpen(false)}>✕</button>
                </div>

                <button className="btn-new-chat" onClick={newConversation}>
                    + Neues Gespräch
                </button>

                <div className="conversation-list">
                    {conversations.map(conv => (
                        <div
                            key={conv.id}
                            className={`conversation-item ${conv.id === activeConvId ? 'active' : ''}`}
                            onClick={() => handleConvClick(conv.id)}
                            onTouchStart={() => handleConvTouchStart(conv.id)}
                            onTouchEnd={handleConvTouchEnd}
                            onTouchCancel={handleConvTouchEnd}
                        >
                            <span className="conv-title">{conv.title}</span>
                            {longPressConvId === conv.id && (
                                <button
                                    className="conv-delete conv-delete-visible"
                                    onClick={(e) => handleDeleteConversation(e, conv.id)}
                                >✕</button>
                            )}
                        </div>
                    ))}
                </div>

                <div className="sidebar-footer">
                    <button className="btn-settings btn-apps-sidebar" onClick={() => navigate('/apps')}>
                        <AppsGridIcon /> Meine Apps
                    </button>
                    <button className="btn-settings" onClick={() => navigate('/settings')}>⚙️ Einstellungen</button>
                    <button className="btn-logout" onClick={logout}>Ausloggen ({email})</button>
                </div>
            </div>

            {sidebarOpen && (
                <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Hauptbereich */}
            <div className="chat-main">
                <div className="chat-header">
                    <button className="btn-menu" onClick={() => setSidebarOpen(true)}><MenuIcon /></button>
                    <span className="chat-title">CC Extension</span>
                    {/* Status-Indikator: zeigt ob Claude Code aktiv ist */}
                    {loading && (
                        <span className="claude-status-badge">
                            <span className="claude-status-dot" />
                            Claude Code arbeitet…
                        </span>
                    )}
                    <button className="btn-icon btn-apps-header" onClick={() => navigate('/apps')} title="Meine Apps">
                        <AppsGridIcon />
                    </button>
                </div>

                <div className="messages-container">
                    {messages.length === 0 && (
                        <div className="welcome-screen">
                            <h2>Was soll ich bauen?</h2>
                            <p>Stell mir eine Frage oder sag mir welche App du dir wünschst.</p>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <MessageBubble key={i} message={msg} />
                    ))}

                    {/* Streaming-Antwort */}
                    {streamingMessage && (
                        <MessageBubble message={{ role: 'assistant', content: streamingMessage + '▊' }} />
                    )}

                    {/* Tool-Events: Datei-Operationen anzeigen */}
                    {loading && aktuelleTools.length > 0 && (
                        <div className="tool-events">
                            {aktuelleTools.slice(-5).map((tool, i) => (
                                <div key={i} className="tool-event-badge">
                                    <span>{tool.emoji}</span>
                                    <span>{tool.text}</span>
                                    {tool.pfad && (
                                        <span className="tool-event-path">{tool.pfad}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Lade-Indikator (solange noch kein Text da ist) */}
                    {loading && !streamingMessage && (
                        <div className="msg-row msg-assistant-row">
                            <div className="msg-bubble msg-bubble-assistant msg-loading">
                                <span>●</span><span>●</span><span>●</span>
                            </div>
                        </div>
                    )}

                    {/* Token-Verbrauch nach der letzten Antwort */}
                    {!loading && letzteUsage && (
                        <div className="usage-info">
                            <span title="Eingabe-Token">⬆ {letzteUsage.inputTokens?.toLocaleString()}</span>
                            <span title="Ausgabe-Token">⬇ {letzteUsage.outputTokens?.toLocaleString()}</span>
                            <span title="Geschätzte Kosten" className="usage-cost">
                                ~${letzteUsage.berechneteKosten?.toFixed(4)}
                            </span>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Eingabebereich – ggf. als Vollbild */}
                <div className={`input-area${inputExpanded ? ' input-area-fullscreen' : ''}`}>
                    {/* Bildvorschau über dem Eingabefeld */}
                    {attachments.length > 0 && (
                        <div className="attachments-preview">
                            {attachments.map((att, i) => (
                                <div key={i} className="attachment-thumb">
                                    <img src={att.previewUrl} alt={att.name} />
                                    <button
                                        className="attachment-remove"
                                        onClick={() => removeAttachment(i)}
                                    >✕</button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="input-row">
                        {/* Verstecktes File-Input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                        />

                        {/* Aufnahme-Modus */}
                        {recording ? (
                            inputExpanded ? (
                                <>
                                    {/* Vollbild + Aufnahme: Textarea oben, Recording-Bar ganz unten */}
                                    <div className="textarea-wrapper fullscreen-textarea">
                                        <button
                                            className="btn-expand"
                                            onClick={() => setInputExpanded(false)}
                                            title="Verkleinern"
                                        >
                                            <CollapseIcon />
                                        </button>
                                        <textarea
                                            ref={inputRef}
                                            className="chat-input"
                                            value={input}
                                            onChange={handleInputChange}
                                            onKeyDown={handleKeyDown}
                                            placeholder={isOnline ? 'Frag Claude…' : '📡 Keine Verbindung'}
                                            rows={1}
                                            disabled={true}
                                        />
                                    </div>
                                    {/* Toolbar ganz unten: Büroklammer | Waveform | Senden */}
                                    <div className="fullscreen-toolbar">
                                        <button className="btn-attach" disabled title="Bild anhängen">
                                            <AttachIcon />
                                        </button>
                                        <div className="recording-indicator">
                                            <button
                                                className="btn-stop-recording"
                                                onClick={handleVoice}
                                                title="Aufnahme stoppen"
                                            >
                                                <StopIcon />
                                            </button>
                                            <div className="voice-waveform">
                                                {[0,1,2,3,4].map(i => (
                                                    <div
                                                        key={i}
                                                        className="voice-bar"
                                                        ref={el => barsRef.current[i] = el}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <div className="input-actions">
                                            <button className="btn-send" onClick={handleSend} disabled={!canSend}>
                                                ↑
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* Normal + Aufnahme: kompakte Inline-Darstellung */}
                                    <button className="btn-attach" disabled title="Bild anhängen">
                                        <AttachIcon />
                                    </button>
                                    <div className="recording-indicator">
                                        <button
                                            className="btn-stop-recording"
                                            onClick={handleVoice}
                                            title="Aufnahme stoppen"
                                        >
                                            <StopIcon />
                                        </button>
                                        <div className="voice-waveform">
                                            {[0,1,2,3,4].map(i => (
                                                <div
                                                    key={i}
                                                    className="voice-bar"
                                                    ref={el => barsRef.current[i] = el}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <div className="input-actions">
                                        <button className="btn-send" onClick={handleSend} disabled={!canSend}>
                                            ↑
                                        </button>
                                    </div>
                                </>
                            )
                        ) : inputExpanded ? (
                            <>
                                {/* Vollbild: Textarea füllt gesamten verfügbaren Bereich */}
                                <div className="textarea-wrapper fullscreen-textarea">
                                    <button
                                        className="btn-expand"
                                        onClick={() => setInputExpanded(false)}
                                        title="Verkleinern"
                                    >
                                        <CollapseIcon />
                                    </button>
                                    <textarea
                                        ref={inputRef}
                                        className="chat-input"
                                        value={input}
                                        onChange={handleInputChange}
                                        onKeyDown={handleKeyDown}
                                        placeholder={isOnline ? 'Frag Claude…' : '📡 Keine Verbindung'}
                                        rows={1}
                                        disabled={loading || !isOnline}
                                    />
                                </div>
                                {/* Vollbild-Toolbar: Büroklammer links, Aktionen rechts */}
                                <div className="fullscreen-toolbar">
                                    <button
                                        className="btn-attach"
                                        onClick={handleAttachClick}
                                        disabled={loading}
                                        title="Bild anhängen"
                                    >
                                        <AttachIcon />
                                    </button>
                                    <div className="input-actions">
                                        <button
                                            className="btn-voice"
                                            onClick={handleVoice}
                                            disabled={loading}
                                            title="Spracheingabe"
                                        >
                                            <MicIcon active={false} />
                                        </button>
                                        <button
                                            className="btn-send"
                                            onClick={handleSend}
                                            disabled={!canSend}
                                        >
                                            ↑
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Normal-Modus: Büroklammer links, Textarea mitte, Aktionen rechts */}
                                <button
                                    className="btn-attach"
                                    onClick={handleAttachClick}
                                    disabled={loading}
                                    title="Bild anhängen"
                                >
                                    <AttachIcon />
                                </button>
                                <div className="textarea-wrapper">
                                    {inputOverflowing && (
                                        <button
                                            className="btn-expand"
                                            onClick={() => setInputExpanded(true)}
                                            title="Vergrößern"
                                        >
                                            <ExpandIcon />
                                        </button>
                                    )}
                                    <textarea
                                        ref={inputRef}
                                        className="chat-input"
                                        value={input}
                                        onChange={handleInputChange}
                                        onKeyDown={handleKeyDown}
                                        placeholder={isOnline ? 'Frag Claude…' : '📡 Keine Verbindung'}
                                        rows={1}
                                        disabled={loading || !isOnline}
                                    />
                                </div>
                                <div className="input-actions">
                                    <button
                                        className="btn-voice"
                                        onClick={handleVoice}
                                        disabled={loading}
                                        title="Spracheingabe"
                                    >
                                        <MicIcon active={false} />
                                    </button>
                                    <button
                                        className="btn-send"
                                        onClick={handleSend}
                                        disabled={!canSend}
                                    >
                                        ↑
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
