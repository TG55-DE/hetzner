// Schmerz-Tagebuch – Einträge erfassen, anzeigen und bearbeiten

import { useState } from 'react';

const SCHMERZORTE = ['Knie', 'Hüfte', 'Rücken', 'Schulter', 'Nacken', 'Sprunggelenk', 'Allgemein'];
const STIMMUNGEN = ['sehr gut', 'gut', 'okay', 'schlecht', 'sehr schlecht'];

// Datumsstring (YYYY-MM-DD) für ein ISO-Datum zurückgeben
function zuDatumsfeld(isoStr) {
  return isoStr ? new Date(isoStr).toISOString().slice(0, 10) : '';
}

export default function SchmerzTagebuch({ eintraege, onAktualisieren }) {
  const [formOffen, setFormOffen] = useState(false);
  const [bearbeiteterEintrag, setBearbeiteterEintrag] = useState(null);
  const [schmerz, setSchmerz] = useState(0);
  const [ort, setOrt] = useState('');
  const [stimmung, setStimmung] = useState('');
  const [notiz, setNotiz] = useState('');
  const [datum, setDatum] = useState('');
  const [ladend, setLadend] = useState(false);
  const [zuLoeschendeId, setZuLoeschendeId] = useState(null);

  function formOeffnen(eintrag = null) {
    if (eintrag) {
      // Bearbeiten-Modus: bestehende Werte vorausfüllen
      setBearbeiteterEintrag(eintrag);
      setSchmerz(eintrag.schmerz);
      setOrt(eintrag.ort || '');
      setStimmung(eintrag.stimmung || '');
      setNotiz(eintrag.notiz || '');
      setDatum(zuDatumsfeld(eintrag.datum));
    } else {
      // Neu-Modus
      setBearbeiteterEintrag(null);
      setSchmerz(0);
      setOrt('');
      setStimmung('');
      setNotiz('');
      setDatum(new Date().toISOString().slice(0, 10));
    }
    setFormOffen(true);
  }

  function formSchliessen() {
    setFormOffen(false);
    setBearbeiteterEintrag(null);
  }

  async function eintragSpeichern() {
    if (schmerz === 0) return;
    setLadend(true);
    try {
      const payload = { schmerz, ort, stimmung, notiz, datum: datum ? new Date(datum).toISOString() : undefined };
      if (bearbeiteterEintrag) {
        // Bearbeiten
        await fetch(`/api/eintraege/${bearbeiteterEintrag.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        // Neu anlegen
        await fetch('/api/eintraege', {
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

  async function eintragLoeschen(id) {
    await fetch(`/api/eintraege/${id}`, { method: 'DELETE' });
    onAktualisieren();
  }

  function formatDatum(isoStr) {
    return new Date(isoStr).toLocaleDateString('de-DE', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function schmerzFarbe(wert) {
    if (wert <= 3) return '#5cb85c';
    if (wert <= 6) return '#f0ad4e';
    return '#d9534f';
  }

  return (
    <>
      <button
        className="btn btn-primaer btn-voll"
        style={{ marginBottom: 16 }}
        onClick={() => formOeffnen()}
      >
        <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Schmerz eintragen
      </button>

      {/* Formular als Modal (Neu & Bearbeiten) */}
      {formOffen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && formSchliessen()}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">
              {bearbeiteterEintrag ? 'Eintrag bearbeiten' : 'Schmerz eintragen'}
            </div>

            <div className="feld">
              <label>Datum</label>
              <input
                type="date"
                value={datum}
                max={new Date().toISOString().slice(0, 10)}
                onChange={e => setDatum(e.target.value)}
              />
            </div>

            <div className="feld">
              <label>Schmerz-Stärke (1–10)</label>
              <div className="schmerz-skala">
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <button
                    key={n}
                    className={`schmerz-btn${schmerz === n ? ' aktiv' : ''}`}
                    style={schmerz === n ? { background: schmerzFarbe(n), borderColor: schmerzFarbe(n) } : {}}
                    onClick={() => setSchmerz(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="feld">
              <label>Schmerzort</label>
              <select value={ort} onChange={e => setOrt(e.target.value)}>
                <option value="">– bitte wählen –</option>
                {SCHMERZORTE.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div className="feld">
              <label>Stimmung</label>
              <select value={stimmung} onChange={e => setStimmung(e.target.value)}>
                <option value="">– optional –</option>
                {STIMMUNGEN.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="feld">
              <label>Notiz (optional)</label>
              <textarea
                rows={3}
                value={notiz}
                onChange={e => setNotiz(e.target.value)}
                placeholder="Zusätzliche Infos…"
              />
            </div>

            <div className="modal-aktionen">
              <button
                className="btn btn-primaer"
                style={{ flex: 1 }}
                onClick={eintragSpeichern}
                disabled={ladend || schmerz === 0}
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

      {/* Eintrags-Liste */}
      {eintraege.length === 0 ? (
        <div className="leer-hinweis">Noch keine Einträge vorhanden</div>
      ) : (
        eintraege.map(e => (
          <div key={e.id} className="liste-eintrag">
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: schmerzFarbe(e.schmerz),
              color: '#fff', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem',
              flexShrink: 0
            }}>
              {e.schmerz}
            </div>
            <div className="liste-eintrag-info">
              <div className="liste-eintrag-titel">{e.ort || 'Allgemein'}</div>
              <div className="liste-eintrag-meta">
                {e.stimmung && `Stimmung: ${e.stimmung} · `}
                {formatDatum(e.datum)}
              </div>
              {e.notiz && (
                <div style={{ fontSize: '0.8rem', color: 'var(--grau-d)', marginTop: 3 }}>
                  {e.notiz}
                </div>
              )}
            </div>
            <div className="liste-eintrag-aktionen">
              <button
                className="icon-btn"
                onClick={() => formOeffnen(e)}
                title="Bearbeiten"
              >
                <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button
                className="icon-btn gefahr"
                onClick={() => setZuLoeschendeId(e.id)}
                title="Löschen"
              >
                <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            </div>
          </div>
        ))
      )}

    {/* Lösch-Bestätigungsdialog */}

    {zuLoeschendeId && (
      <div className="modal-overlay" onClick={() => setZuLoeschendeId(null)}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 320 }}>
          <div className="modal-titel">Wirklich löschen?</div>
          <p style={{ margin: '12px 0 20px', color: 'var(--grau-d)', fontSize: '0.9rem' }}>
            Dieser Eintrag wird dauerhaft gelöscht und kann nicht wiederhergestellt werden.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn btn-gefahr"
              style={{ flex: 1 }}
              onClick={() => { eintragLoeschen(zuLoeschendeId); setZuLoeschendeId(null); }}
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
