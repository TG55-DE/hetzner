import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard.jsx';
import SchmerzTagebuch from './components/SchmerzTagebuch.jsx';
import Termine from './components/Termine.jsx';
import UebungsVerwaltung from './components/UebungsVerwaltung.jsx';
import TrainingsSession from './components/TrainingsSession.jsx';
import SessionVerlauf from './components/SessionVerlauf.jsx';

// SVG-Icons für die Navigation
const Icons = {
  Dashboard: () => (
    <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
  ),
  Schmerz: () => (
    <svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
  ),
  Kalender: () => (
    <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  ),
  Uebungen: () => (
    <svg viewBox="0 0 24 24"><path d="M6.5 6.5h11M6.5 12h11M6.5 17.5h7"/><circle cx="4" cy="6.5" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="17.5" r="1"/></svg>
  ),
  Training: () => (
    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  ),
  Verlauf: () => (
    <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  ),
};

export default function App() {
  const [aktiveTab, setAktiveTab] = useState('dashboard');
  const [daten, setDaten] = useState(null);

  // Alle Daten vom Backend laden
  async function ladeDaten() {
    try {
      const res = await fetch('/api/daten');
      const json = await res.json();
      setDaten(json);
    } catch (err) {
      console.error('Fehler beim Laden der Daten:', err);
    }
  }

  useEffect(() => {
    ladeDaten();
  }, []);

  const tabs = [
    { id: 'dashboard', label: 'Übersicht', Icon: Icons.Dashboard },
    { id: 'training',  label: 'Training',  Icon: Icons.Training },
    { id: 'verlauf',   label: 'Verlauf',   Icon: Icons.Verlauf },
    { id: 'uebungen',  label: 'Übungen',   Icon: Icons.Uebungen },
    { id: 'schmerzen', label: 'Schmerzen', Icon: Icons.Schmerz },
    { id: 'termine',   label: 'Termine',   Icon: Icons.Kalender },
  ];

  // Datum heute als lesbarer Text
  const heute = new Date().toLocaleDateString('de-DE', {
    weekday: 'short', day: 'numeric', month: 'short'
  });

  return (
    <div className="app">
      <header className="app-header">
        <h1>Reha Tracker</h1>
        <p>{heute}</p>
      </header>

      <nav className="app-nav">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`nav-btn${aktiveTab === id ? ' aktiv' : ''}`}
            onClick={() => setAktiveTab(id)}
          >
            <Icon />
            {label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {!daten ? (
          <div className="leer-hinweis">Daten werden geladen…</div>
        ) : (
          <>
            {aktiveTab === 'dashboard' && <Dashboard daten={daten} onAktualisieren={ladeDaten} onTabWechsel={setAktiveTab} />}
            {aktiveTab === 'schmerzen' && <SchmerzTagebuch eintraege={daten.eintraege} onAktualisieren={ladeDaten} />}
            {aktiveTab === 'termine'   && <Termine termine={daten.termine} onAktualisieren={ladeDaten} />}
            {aktiveTab === 'uebungen'  && <UebungsVerwaltung uebungen={daten.uebungen} sets={daten.sets || []} onAktualisieren={ladeDaten} />}
            {aktiveTab === 'training'  && <TrainingsSession uebungen={daten.uebungen} sets={daten.sets || []} onAktualisieren={ladeDaten} />}
            {aktiveTab === 'verlauf'   && <SessionVerlauf sessions={daten.sessions || []} sets={daten.sets || []} uebungen={daten.uebungen} />}
          </>
        )}
      </main>
    </div>
  );
}
