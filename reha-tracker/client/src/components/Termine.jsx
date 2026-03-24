// Termine – Arzt- und Therapietermine verwalten und bearbeiten

import { useState } from 'react';

export default function Termine({ termine, onAktualisieren }) {
  const [formOffen, setFormOffen] = useState(false);
  const [bearbeiteterTermin, setBearbeiteterTermin] = useState(null);
  const [titel, setTitel] = useState('');
  const [datum, setDatum] = useState('');
  const [uhrzeit, setUhrzeit] = useState('');
  const [ort, setOrt] = useState('');
  const [notiz, setNotiz] = useState('');
  const [ladend, setLadend] = useState(false);
  const [zuLoeschendeId, setZuLoeschendeId] = useState(null);

  function formOeffnen(termin = null) {
    if (termin) {
      // Bearbeiten-Modus
      setBearbeiteterTermin(termin);
      setTitel(termin.titel);
      setDatum(termin.datum);
      setUhrzeit(termin.uhrzeit || '');
      setOrt(termin.ort || '');
      setNotiz(termin.notiz || '');
    } else {
      // Neu-Modus
      setBearbeiteterTermin(null);
      setTitel('');
      setDatum('');
      setUhrzeit('');
      setOrt('');
      setNotiz('');
    }
    setFormOffen(true);
  }

  function formSchliessen() {
    setFormOffen(false);
    setBearbeiteterTermin(null);
  }

  async function terminSpeichern() {
    if (!titel || !datum) return;
    setLadend(true);
    try {
      const payload = { titel, datum, uhrzeit, ort, notiz };
      if (bearbeiteterTermin) {
        // Bearbeiten
        await fetch(`/api/termine/${bearbeiteterTermin.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        // Neu anlegen
        await fetch('/api/termine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      formSchliessen();
      onAktualisieren();
    } finally {
      setLadend(false);
    }
  }

  async function terminLoeschen(id) {
    await fetch(`/api/termine/${id}`, { method: 'DELETE' });
    onAktualisieren();
  }

  function formatDatum(dateStr) {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  function istVergangen(dateStr) {
    return new Date(dateStr) < new Date(new Date().toDateString());
  }

  return (
    <>
      <button
        className="btn btn-primaer btn-voll"
        style={{ marginBottom: 16 }}
        onClick={() => formOeffnen()}
      >
        <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Termin eintragen
      </button>

      {/* Formular als Modal (Neu & Bearbeiten) */}
      {formOffen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && formSchliessen()}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">
              {bearbeiteterTermin ? 'Termin bearbeiten' : 'Termin eintragen'}
            </div>

            <div className="feld">
              <label>Bezeichnung*</label>
              <input
                type="text"
                value={titel}
                onChange={e => setTitel(e.target.value)}
                placeholder="z.B. Physiotherapie"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="feld">
                <label>Datum*</label>
                <input
                  type="date"
                  value={datum}
                  onChange={e => setDatum(e.target.value)}
                />
              </div>
              <div className="feld">
                <label>Uhrzeit</label>
                <input
                  type="time"
                  value={uhrzeit}
                  onChange={e => setUhrzeit(e.target.value)}
                />
              </div>
            </div>

            <div className="feld">
              <label>Ort / Arzt</label>
              <input
                type="text"
                value={ort}
                onChange={e => setOrt(e.target.value)}
                placeholder="z.B. Dr. Müller, Praxis Musterstadt"
              />
            </div>

            <div className="feld">
              <label>Notiz (optional)</label>
              <textarea
                rows={2}
                value={notiz}
                onChange={e => setNotiz(e.target.value)}
                placeholder="Zusätzliche Infos…"
              />
            </div>

            <div className="modal-aktionen">
              <button
                className="btn btn-primaer"
                style={{ flex: 1 }}
                onClick={terminSpeichern}
                disabled={ladend || !titel || !datum}
              >
                Speichern
              </button>
              <button className="btn btn-hell" onClick={formSchliessen}>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Termin-Liste */}
      {termine.length === 0 ? (
        <div className="leer-hinweis">Noch keine Termine eingetragen</div>
      ) : (
        termine.map(t => {
          const vergangen = istVergangen(t.datum);
          return (
            <div
              key={t.id}
              className="liste-eintrag"
              style={{ opacity: vergangen ? 0.55 : 1 }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: vergangen ? 'var(--grau-m)' : 'var(--blau)',
                color: vergangen ? 'var(--grau-d)' : '#fff',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontWeight: 700, lineHeight: 1.1
              }}>
                <span style={{ fontSize: '1.1rem' }}>
                  {new Date(t.datum).getDate()}
                </span>
                <span style={{ fontSize: '0.65rem' }}>
                  {new Date(t.datum).toLocaleDateString('de-DE', { month: 'short' })}
                </span>
              </div>
              <div className="liste-eintrag-info">
                <div className="liste-eintrag-titel">{t.titel}</div>
                <div className="liste-eintrag-meta">
                  {formatDatum(t.datum)}
                  {t.uhrzeit && ` um ${t.uhrzeit} Uhr`}
                </div>
                {t.ort && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--grau-d)', marginTop: 2 }}>{t.ort}</div>
                )}
                {t.notiz && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--grau-d)', marginTop: 2 }}>{t.notiz}</div>
                )}
              </div>
              <div className="liste-eintrag-aktionen">
                <button
                  className="icon-btn"
                  onClick={() => formOeffnen(t)}
                  title="Bearbeiten"
                >
                  <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button
                  className="icon-btn gefahr"
                  onClick={() => setZuLoeschendeId(t.id)}
                  title="Löschen"
                >
                  <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
              </div>
            </div>
          );
        })
      )}

    {/* Lösch-Bestätigungsdialog */}
    {zuLoeschendeId && (
      <div className="modal-overlay" onClick={() => setZuLoeschendeId(null)}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 320 }}>
          <div className="modal-titel">Wirklich löschen?</div>
          <p style={{ margin: '12px 0 20px', color: 'var(--grau-d)', fontSize: '0.9rem' }}>
            Dieser Termin wird dauerhaft gelöscht und kann nicht wiederhergestellt werden.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn btn-gefahr"
              style={{ flex: 1 }}
              onClick={() => { terminLoeschen(zuLoeschendeId); setZuLoeschendeId(null); }}
            >
              Ja, löschen
            </button>
            <button className="btn btn-hell" onClick={() => setZuLoeschendeId(null)}>
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
