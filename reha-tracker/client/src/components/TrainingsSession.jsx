// Trainings-Session – Schritt-für-Schritt durch ein Übungs-Set

import { useState } from 'react';

// localStorage-Schlüssel für mehrere Zwischenstände
const SPEICHER_KEY = 'reha-tracker-zwischenstaende';

// Alle gespeicherten Zwischenstände laden (Array)
function zwischenstaendeLaden() {
  try {
    const raw = localStorage.getItem(SPEICHER_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    // Rückwärtskompatibilität: altes Format (einzelnes Objekt) umwandeln
    if (!Array.isArray(data)) return data ? [{ ...data, id: data.gespeichertUm }] : [];
    return data;
  } catch {
    return [];
  }
}

// Aktualisierten Array in localStorage schreiben
function zwischenstaendeSpeichern(liste) {
  localStorage.setItem(SPEICHER_KEY, JSON.stringify(liste));
}

// Einen einzelnen Zwischenstand anhand der ID entfernen
function zwischenstandEntfernen(id) {
  const liste = zwischenstaendeLaden();
  zwischenstaendeSpeichern(liste.filter(s => s.id !== id));
}

// Hilfsfunktion: Anzahl Zyklen für eine Übung
function getZyklenAnzahl(uebung) {
  return Math.max(1, uebung?.zyklen || 1);
}

// Ampelfarbe: rot=0, gelb=teilweise, grün=Ziel erreicht
function ampelFarbe(istWert, zielWdh) {
  if (istWert === 0) return '#ef4444';      // rot
  if (zielWdh > 0 && istWert >= zielWdh) return '#22c55e'; // grün
  return '#eab308';                          // gelb
}

// Status aus Zykluswerten berechnen (für Speichern & Zusammenfassung)
function statusBerechnen(werte, zielWdh) {
  if (werte.every(v => v === 0)) return 'nicht';
  if (zielWdh > 0 && werte.every(v => v >= zielWdh)) return 'ausgefuehrt';
  return 'teilweise';
}

export default function TrainingsSession({ uebungen, sets, onAktualisieren }) {
  // Phasen: 'auswahl' | 'training' | 'abschluss'
  const [phase, setPhase] = useState('auswahl');
  const [gewaehlteSetId, setGewaehlteSetId] = useState(null);
  const [aktuellerIndex, setAktuellerIndex] = useState(0);
  // Zykluswerte: { [uebungId]: number[] } – ein Wert pro Zyklus (für Berechnungen)
  const [zyklusWerte, setZyklusWerte] = useState({});
  // Eingabetexte: { [uebungId]: string[] } – Rohtext der Eingabefelder (erlaubt leere Eingabe)
  const [eingabeTexte, setEingabeTexte] = useState({});
  const [speichernd, setSpeichernd] = useState(false);
  // Liste aller gespeicherten Zwischenstände (aus localStorage)
  const [zwischenstaende, setZwischenstaende] = useState(() => zwischenstaendeLaden());
  // ID des aktuell fortgesetzten Zwischenstands (null = frisches Training)
  const [aktiverZwischenstandId, setAktiverZwischenstandId] = useState(null);

  const gewaehlterSet = sets.find(s => s.id === gewaehlteSetId);
  const setUebungen = gewaehlterSet
    ? (gewaehlterSet.uebungsIds || []).map(id => uebungen.find(u => u.id === id)).filter(Boolean)
    : [];
  const aktuelleUebung = setUebungen[aktuellerIndex];

  // Zielboxen-Einträge für eine Übung
  function vorgabenText(u) {
    const teile = [];
    if (u.wiederholungen) teile.push({ zahl: u.wiederholungen, label: 'Wdh.' });
    if (u.zyklen)         teile.push({ zahl: u.zyklen,         label: 'Zyklen' });
    if (u.minuten)        teile.push({ zahl: u.minuten,        label: 'Pause' });
    return teile;
  }

  // Einen einzelnen Zykluswert aktualisieren
  function updateZyklusWert(uebungId, index, wert) {
    const anzahl = getZyklenAnzahl(aktuelleUebung);
    // Rohtext für Anzeige speichern (erlaubt leere/teilweise Eingabe)
    setEingabeTexte(prev => {
      const aktuelleTexte = prev[uebungId] ? [...prev[uebungId]] : Array(anzahl).fill('');
      aktuelleTexte[index] = wert;
      return { ...prev, [uebungId]: aktuelleTexte };
    });
    // Numerischen Wert für Berechnungen speichern
    setZyklusWerte(prev => {
      const aktuelleWerte = prev[uebungId]
        ? [...prev[uebungId]]
        : Array(anzahl).fill(0);
      aktuelleWerte[index] = wert === '' ? 0 : Math.max(0, parseInt(wert) || 0);
      return { ...prev, [uebungId]: aktuelleWerte };
    });
  }

  // Aktuelle Zykluswerte für eine Übung holen (mit Fallback auf Nullen)
  function getWerte(uebung) {
    return zyklusWerte[uebung.id] || Array(getZyklenAnzahl(uebung)).fill(0);
  }

  // Frisches Training starten (ohne vorherigen Stand zu löschen)
  function trainingStarten(setId) {
    setAktiverZwischenstandId(null);
    setGewaehlteSetId(setId);
    setAktuellerIndex(0);
    setZyklusWerte({});
    setEingabeTexte({});
    setPhase('training');
  }

  // Aktuellen Stand sichern und zur Auswahl zurückkehren
  function zwischenspeichern() {
    const jetzt = new Date().toISOString();
    // Bei fortgesetztem Training: bestehenden Eintrag aktualisieren
    const id = aktiverZwischenstandId || jetzt;
    const stand = {
      id,
      setId: gewaehlteSetId,
      aktuellerIndex,
      zyklusWerte,
      eingabeTexte,
      gespeichertUm: jetzt,
    };

    const alteListe = zwischenstaendeLaden();
    let neueListe;
    if (aktiverZwischenstandId) {
      // Vorhandenen Eintrag aktualisieren
      neueListe = alteListe.map(s => s.id === aktiverZwischenstandId ? stand : s);
    } else {
      // Neuen Eintrag hinzufügen
      neueListe = [...alteListe, stand];
    }
    zwischenstaendeSpeichern(neueListe);
    setZwischenstaende(neueListe);
    setAktiverZwischenstandId(null);
    setPhase('auswahl');
    setGewaehlteSetId(null);
  }

  // Einen gespeicherten Zwischenstand fortsetzen
  function fortsetzen(stand) {
    setAktiverZwischenstandId(stand.id);
    setGewaehlteSetId(stand.setId);
    setAktuellerIndex(stand.aktuellerIndex);
    setZyklusWerte(stand.zyklusWerte);
    setEingabeTexte(stand.eingabeTexte);
    setPhase('training');
  }

  // Einen gespeicherten Zwischenstand löschen
  function zwischenstandVerwerfen(id) {
    zwischenstandEntfernen(id);
    setZwischenstaende(prev => prev.filter(s => s.id !== id));
  }

  function weiter() {
    if (aktuellerIndex < setUebungen.length - 1) {
      setAktuellerIndex(prev => prev + 1);
    } else {
      setPhase('abschluss');
    }
  }

  function zurueck() {
    if (aktuellerIndex > 0) {
      setAktuellerIndex(prev => prev - 1);
    }
  }

  async function sessionSpeichern() {
    setSpeichernd(true);
    try {
      const ergebnisseListe = setUebungen.map(u => {
        const werte = getWerte(u);
        const ziel = u.wiederholungen || 0;
        return {
          uebungId: u.id,
          status: statusBerechnen(werte, ziel),
          // Gesamtsumme aller Zyklen als istWert speichern
          istWert: werte.reduce((s, v) => s + v, 0) || null,
          notiz: '',
        };
      });

      await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setId: gewaehlteSetId,
          ergebnisse: ergebnisseListe,
        }),
      });

      // Nur den aktiven Zwischenstand nach erfolgreichem Speichern entfernen
      if (aktiverZwischenstandId) {
        zwischenstandEntfernen(aktiverZwischenstandId);
        setZwischenstaende(prev => prev.filter(s => s.id !== aktiverZwischenstandId));
        setAktiverZwischenstandId(null);
      }

      onAktualisieren();
      setPhase('auswahl');
      setGewaehlteSetId(null);
    } finally {
      setSpeichernd(false);
    }
  }

  // ===== PHASE: SET AUSWÄHLEN =====
  if (phase === 'auswahl') {
    return (
      <div>
        {/* Alle unterbrochenen Trainings anzeigen */}
        {zwischenstaende.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 10, color: 'var(--grau-d)' }}>
              Unterbrochene Trainings ({zwischenstaende.length})
            </div>
            {zwischenstaende.map(stand => {
              const zwSet = sets.find(s => s.id === stand.setId);
              if (!zwSet) return null;
              const zwAnzahl = (zwSet.uebungsIds || []).length;
              const datum = new Date(stand.gespeichertUm);
              const datumText = datum.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
              const uhrzeitText = datum.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
              return (
                <div
                  key={stand.id}
                  style={{
                    background: '#fff',
                    border: '2px solid var(--blau)',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 2 }}>
                    {zwSet.name}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--grau-d)', marginBottom: 12 }}>
                    Übung {stand.aktuellerIndex + 1} von {zwAnzahl} · {datumText} um {uhrzeitText}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-primaer"
                      style={{ flex: 2 }}
                      onClick={() => fortsetzen(stand)}
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                      Fortsetzen
                    </button>
                    <button
                      className="btn btn-hell"
                      style={{ flex: 1 }}
                      onClick={() => {
                        if (window.confirm(`„${zwSet.name}" verwerfen?`)) {
                          zwischenstandVerwerfen(stand.id);
                        }
                      }}
                    >
                      Verwerfen
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginBottom: 16, color: 'var(--grau-d)', fontSize: '0.9rem' }}>
          Wähle ein Set aus, um das Training zu starten.
        </div>

        {sets.length === 0 ? (
          <div className="leer-hinweis">
            Noch keine Sets angelegt.<br />
            Gehe zu „Übungen" und lege zuerst ein Set an.
          </div>
        ) : (
          sets.map(s => {
            const anzahl = (s.uebungsIds || []).length;
            return (
              <button
                key={s.id}
                onClick={() => trainingStarten(s.id)}
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '16px', marginBottom: 10,
                  background: 'var(--weiss)',
                  border: '1.5px solid var(--grau-m)',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 14,
                  transition: 'border-color 0.2s',
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: 'var(--blau)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <svg viewBox="0 0 24 24" width="20" height="20" stroke="#fff" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{s.name}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--grau-d)', marginTop: 2 }}>
                    {anzahl} Übung{anzahl !== 1 ? 'en' : ''}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    );
  }

  // ===== PHASE: TRAINING =====
  if (phase === 'training' && aktuelleUebung) {
    const vorgaben = vorgabenText(aktuelleUebung);
    const fortschritt = (aktuellerIndex / setUebungen.length) * 100;
    const werte = getWerte(aktuelleUebung);
    const texte = eingabeTexte[aktuelleUebung.id] || [];
    const ziel = aktuelleUebung.wiederholungen || 0;
    const anzahlZyklen = getZyklenAnzahl(aktuelleUebung);

    return (
      <div>
        {/* Fortschrittsanzeige */}
        <div className="training-fortschritt">
          Übung {aktuellerIndex + 1} von {setUebungen.length} – {gewaehlterSet?.name}
        </div>
        <div className="fortschritt-balken">
          <div className="fortschritt-balken-fill" style={{ width: `${fortschritt}%` }} />
        </div>

        {/* Übungs-Karte mit Zielwerten */}
        <div className="training-schritt">
          <div className="training-uebung-name">{aktuelleUebung.name}</div>

          {vorgaben.length > 0 && (
            <div className="training-vorgabe">
              {vorgaben.map(({ zahl, label }) => (
                <div key={label} className="training-vorgabe-wert">
                  <div className="training-vorgabe-zahl">{zahl}</div>
                  <div className="training-vorgabe-label">{label}</div>
                </div>
              ))}
            </div>
          )}

          {aktuelleUebung.notiz && (
            <div style={{
              fontSize: '0.85rem', color: 'var(--grau-d)',
              background: 'var(--weiss)', borderRadius: 8, padding: '8px 12px',
              textAlign: 'left'
            }}>
              {aktuelleUebung.notiz}
            </div>
          )}
        </div>

        {/* Zyklen-Eingabe mit Traffic-Light */}
        <div style={{
          background: '#ffffff',
          borderRadius: 16,
          padding: '20px 16px',
          marginBottom: 16,
          border: '2px solid #4A90D9',
        }}>
          {Array.from({ length: anzahlZyklen }, (_, i) => {
            const istWert = werte[i] ?? 0;
            const farbe = ampelFarbe(istWert, ziel);
            const istLetzter = i === anzahlZyklen - 1;
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: istLetzter ? 0 : 16,
                }}
              >
                {/* Zyklus-Bezeichnung */}
                <div style={{
                  color: '#2d3748',
                  fontWeight: 700,
                  fontSize: '1.25rem',
                  flex: 1,
                  whiteSpace: 'nowrap',
                }}>
                  Zyklus {i + 1}
                </div>

                {/* Eingabefeld */}
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={texte[i] !== undefined ? texte[i] : (istWert === 0 ? '' : String(istWert))}
                  placeholder="0"
                  onChange={e => updateZyklusWert(aktuelleUebung.id, i, e.target.value)}
                  style={{
                    width: 110,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: 'none',
                    fontSize: '1.6rem',
                    fontWeight: 700,
                    color: 'var(--blau)',
                    textAlign: 'center',
                    background: '#fff',
                    flexShrink: 0,
                  }}
                />

                {/* Traffic-Light Kreis */}
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: farbe,
                  flexShrink: 0,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
                }} />
              </div>
            );
          })}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 8 }}>
          {aktuellerIndex > 0 && (
            <button className="btn btn-hell" onClick={zurueck} style={{ flex: 1 }}>
              <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
              Zurück
            </button>
          )}
          <button
            className="btn btn-primaer"
            style={{ flex: 2 }}
            onClick={weiter}
          >
            {aktuellerIndex < setUebungen.length - 1 ? (
              <>
                Weiter
                <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
              </>
            ) : (
              <>
                Abschluss
                <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
              </>
            )}
          </button>
        </div>

        <button
          className="btn btn-hell btn-voll"
          style={{ marginTop: 8 }}
          onClick={zwischenspeichern}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="1" width="12" height="6" rx="1"/>
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="7 21 7 13 17 13 17 21"/>
          </svg>
          Zwischenspeichern
        </button>

        {/* Abbrechen geht zurück zur Auswahl ohne den Zwischenstand zu löschen */}
        <button
          className="btn btn-hell btn-voll"
          style={{ marginTop: 8 }}
          onClick={() => {
            if (window.confirm('Zur Auswahl zurückkehren? Aktuelle Eingaben gehen verloren (gespeicherte Zwischenstände bleiben erhalten).')) {
              setPhase('auswahl');
              setGewaehlteSetId(null);
              setAktiverZwischenstandId(null);
            }
          }}
        >
          Abbrechen
        </button>
      </div>
    );
  }

  // ===== PHASE: ABSCHLUSS =====
  if (phase === 'abschluss') {
    // Status pro Übung aus Zykluswerten berechnen
    const ausgefuehrt = setUebungen.filter(u => statusBerechnen(getWerte(u), u.wiederholungen || 0) === 'ausgefuehrt').length;
    const teilweise   = setUebungen.filter(u => statusBerechnen(getWerte(u), u.wiederholungen || 0) === 'teilweise').length;
    const nicht       = setUebungen.filter(u => statusBerechnen(getWerte(u), u.wiederholungen || 0) === 'nicht').length;

    return (
      <div>
        <div className="karte" style={{ textAlign: 'center', padding: '24px 16px' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: ausgefuehrt === setUebungen.length ? 'var(--gruen)' : 'var(--blau)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px'
          }}>
            <svg viewBox="0 0 24 24" width="32" height="32" stroke="#fff" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>
          <div style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: 4 }}>Training abgeschlossen!</div>
          <div style={{ color: 'var(--grau-d)', fontSize: '0.88rem' }}>{gewaehlterSet?.name}</div>
        </div>

        {/* Zusammenfassung */}
        <div className="karte">
          <div className="karte-titel">Zusammenfassung</div>
          <div className="stats-grid" style={{ marginBottom: 16 }}>
            <div className="stat-karte">
              <div className="stat-zahl" style={{ color: 'var(--gruen)' }}>{ausgefuehrt}</div>
              <div className="stat-label">Ausgeführt</div>
            </div>
            <div className="stat-karte">
              <div className="stat-zahl" style={{ color: 'var(--orange)' }}>{teilweise}</div>
              <div className="stat-label">Teilweise</div>
            </div>
            <div className="stat-karte">
              <div className="stat-zahl" style={{ color: 'var(--rot)' }}>{nicht}</div>
              <div className="stat-label">Nicht</div>
            </div>
            <div className="stat-karte">
              <div className="stat-zahl">{setUebungen.length}</div>
              <div className="stat-label">Gesamt</div>
            </div>
          </div>

          {/* Detail pro Übung */}
          {setUebungen.map(u => {
            const werte = getWerte(u);
            const ziel = u.wiederholungen || 0;
            const status = statusBerechnen(werte, ziel);
            const gesamtWert = werte.reduce((s, v) => s + v, 0);
            return (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 0', borderBottom: '1px solid var(--grau-m)'
              }}>
                <div style={{ flex: 1, fontSize: '0.88rem', fontWeight: 500 }}>{u.name}</div>
                <div>
                  {gesamtWert > 0 && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--grau-d)', marginRight: 6 }}>
                      {gesamtWert}×
                    </span>
                  )}
                  <span className={`tag ${status === 'ausgefuehrt' ? 'tag-gruen' : status === 'teilweise' ? 'tag-orange' : 'tag-rot'}`}>
                    {status === 'ausgefuehrt' ? 'Ausgeführt' : status === 'teilweise' ? 'Teilweise' : 'Nicht'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <button
          className="btn btn-erfolg btn-voll"
          onClick={sessionSpeichern}
          disabled={speichernd}
        >
          <svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Session speichern
        </button>

        <button
          className="btn btn-hell btn-voll"
          style={{ marginTop: 8 }}
          onClick={() => {
            setPhase('auswahl');
            setGewaehlteSetId(null);
            setAktiverZwischenstandId(null);
          }}
        >
          Ohne Speichern beenden
        </button>
      </div>
    );
  }

  return null;
}
