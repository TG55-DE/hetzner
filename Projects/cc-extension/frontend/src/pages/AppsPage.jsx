// Apps-Seite: Zeigt alle bisher gebauten und deployt Apps
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApps } from '../services/api';
import './AppsPage.css';

// Automatische Aktualisierung alle 30 Sekunden
const AKTUALISIERUNGS_INTERVALL = 30000;

export default function AppsPage() {
    const navigate = useNavigate();
    const [apps, setApps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [aktualisiert, setAktualisiert] = useState(null);
    const [aktualisiert_gerade, setAktualisiertGerade] = useState(false);

    const loadApps = useCallback(async (istManuell = false) => {
        // Bei manuellem Refresh: Dreh-Animation starten
        if (istManuell) setAktualisiertGerade(true);
        try {
            const data = await getApps();
            setApps(data);
            setAktualisiert(new Date());
        } catch (err) {
            console.error('Apps laden fehlgeschlagen:', err);
        } finally {
            setLoading(false);
            if (istManuell) {
                // Animation kurz sichtbar lassen, dann stoppen
                setTimeout(() => setAktualisiertGerade(false), 600);
            }
        }
    }, []);

    useEffect(() => {
        // Beim ersten Öffnen laden
        loadApps();

        // Danach alle 30 Sekunden automatisch aktualisieren
        const interval = setInterval(() => loadApps(), AKTUALISIERUNGS_INTERVALL);

        // Interval beim Verlassen der Seite stoppen
        return () => clearInterval(interval);
    }, [loadApps]);

    // Uhrzeit der letzten Aktualisierung formatieren
    function zeitFormatieren(datum) {
        if (!datum) return '';
        return datum.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    return (
        <div className="apps-page">
            <div className="apps-header">
                <button className="btn-back" onClick={() => navigate('/')}>← Zurück</button>
                <h1>Meine Apps</h1>
                <button
                    className={`btn-refresh ${aktualisiert_gerade ? 'dreht' : ''}`}
                    onClick={() => loadApps(true)}
                    title="Jetzt aktualisieren"
                    aria-label="Aktualisieren"
                >
                    {/* Refresh-Icon (SVG) */}
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                        <path d="M21 3v5h-5"/>
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                        <path d="M8 16H3v5"/>
                    </svg>
                </button>
            </div>

            {/* Zeitstempel der letzten Aktualisierung */}
            {aktualisiert && (
                <div className="apps-aktualisiert">
                    Zuletzt aktualisiert: {zeitFormatieren(aktualisiert)} · alle 30s automatisch
                </div>
            )}

            <div className="apps-content">
                {loading && <p className="loading-text">Lade Apps...</p>}

                {!loading && apps.length === 0 && (
                    <div className="apps-empty">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{opacity:0.4}}>
                            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                            <path d="M2 17l10 5 10-5"/>
                            <path d="M2 12l10 5 10-5"/>
                        </svg>
                        <p>Noch keine Apps gebaut.</p>
                        <p>Schreib im Chat z.B. „Baue mir eine Todo-Liste"!</p>
                        <button className="btn-primary" onClick={() => navigate('/')}>
                            Zum Chat
                        </button>
                    </div>
                )}

                <div className="apps-grid">
                    {apps.map(app => (
                        <div key={app.id} className="app-card">
                            <div className="app-icon">
                                {/* Globus-Icon (SVG) */}
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"/>
                                    <path d="M2 12h20"/>
                                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                                </svg>
                            </div>
                            <div className="app-info">
                                <h3>{app.app_name}</h3>
                                <p className={`app-status ${app.status}`}>
                                    <span className={`status-dot ${app.status}`}></span>
                                    {app.status === 'running' ? 'Läuft' : 'Gestoppt'}
                                </p>
                                <a
                                    href={`http://91.99.56.96:${app.port}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="app-link"
                                >
                                    Port {app.port} öffnen →
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
