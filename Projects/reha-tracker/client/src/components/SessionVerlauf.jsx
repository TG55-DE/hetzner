// Session-Verlauf – Trainings-Historie und Vergleich zweier Sessions

import { useState } from 'react';

const STATUS_FARBE = {
  ausgefuehrt: { tag: 'tag-gruen', text: 'Ausgeführt' },
  teilweise:   { tag: 'tag-orange', text: 'Teilweise' },
  nicht:       { tag: 'tag-rot', text: 'Nicht' },
};

export default function SessionVerlauf({ sessions, sets, uebungen }) {
  const [vergleichIds, setVergleichIds] = useState([null, null]);
  const [vergleichModus, setVergleichModus] = useState(false);

  // Bearbeiten-State
  const [bearbeiteteSession, setBearbeiteteSession] = useState(null);
  const [editDatum, setEditDatum] = useState('');
  const [editErgebnisse, setEditErgebnisse] = useState([]);
  const [editLadend, setEditLadend] = useState(false);

  function formatDatum(isoStr) {
    return new Date(isoStr).toLocaleDateString('de-DE', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function setName(setId) {
    return sets.find(s => s.id === setId)?.name || 'Unbekanntes Set';
  }

  function uebungName(uebungId) {
    return uebungen.find(u => u.id === uebungId)?.name || 'Unbekannte Übung';
  }

  // Sessions neuste zuerst
  const sortierteSessions = [...sessions].reverse();

  function vergleichSessionWaehlen(position, sessionId) {
    setVergleichIds(prev => {
      const neu = [...prev];
      neu[position] = sessionId;
      return neu;
    });
  }

  const session1 = sessions.find(s => s.id === vergleichIds[0]);
  const session2 = sessions.find(s => s.id === vergleichIds[1]);

  // Alle Übungs-IDs aus beiden Sessions für Vergleich
  function vergleichUebungsIds() {
    const ids = new Set();
    session1?.ergebnisse?.forEach(e => ids.add(e.uebungId));
    session2?.ergebnisse?.forEach(e => ids.add(e.uebungId));
    return [...ids];
  }

  // Bearbeiten-Modal öffnen
  function sessionBearbeiten(session) {
    setBearbeiteteSession(session);
    // Datum als YYYY-MM-DDThh:mm für datetime-local Input
    const d = new Date(session.datum);
    const pad = n => String(n).padStart(2, '0');
    const lokalDatum = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setEditDatum(lokalDatum);
    // Tiefe Kopie der Ergebnisse
    setEditErgebnisse((session.ergebnisse || []).map(e => ({ ...e })));
  }

  function bearbeitenSchliessen() {
    setBearbeiteteSession(null);
    setEditErgebnisse([]);
  }

  function ergebnisAendern(uebungId, feld, wert) {
    setEditErgebnisse(prev =>
      prev.map(e => e.uebungId === uebungId ? { ...e, [feld]: wert } : e)
    );
  }

  async function sessionSpeichern() {
    if (!bearbeiteteSession) return;
    setEditLadend(true);
    try {
      await fetch(`/api/sessions/${bearbeiteteSession.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datum: editDatum ? new Date(editDatum).toISOString() : bearbeiteteSession.datum,
          ergebnisse: editErgebnisse,
        }),
      });
      bearbeitenSchliessen();
      // Seite neu laden damit Daten aktualisiert sind
      window.location.reload();
    } finally {
      setEditLadend(false);
    }
  }

  return (
    <div>
      {/* Tabs: Verlauf | Vergleich */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className={`btn${!vergleichModus ? ' btn-primaer' : ' btn-hell'}`}
          style={{ flex: 1 }}
          onClick={() => setVergleichModus(false)}
        >
          Verlauf
        </button>
        <button
          className={`btn${vergleichModus ? ' btn-primaer' : ' btn-hell'}`}
          style={{ flex: 1 }}
          onClick={() => setVergleichModus(true)}
          disabled={sessions.length < 2}
        >
          Vergleich
        </button>
      </div>

      {/* ===== VERLAUF ===== */}
      {!vergleichModus && (
        <>
          {sortierteSessions.length === 0 ? (
            <div className="leer-hinweis">Noch keine Sessions gespeichert</div>
          ) : (
            sortierteSessions.map(s => {
              const ausgefuehrt = s.ergebnisse?.filter(e => e.status === 'ausgefuehrt').length || 0;
              const teilweise   = s.ergebnisse?.filter(e => e.status === 'teilweise').length || 0;
              const nicht       = s.ergebnisse?.filter(e => e.status === 'nicht').length || 0;
              const gesamt      = s.ergebnisse?.length || 0;

              return (
                <div key={s.id} className="karte">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{setName(s.setId)}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--grau-d)', marginTop: 2 }}>
                        {formatDatum(s.datum)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <div style={{ textAlign: 'right', fontSize: '0.78rem', color: 'var(--grau-d)' }}>
                        {gesamt} Übungen
                      </div>
                      <button
                        className="icon-btn"
                        onClick={() => sessionBearbeiten(s)}
                        title="Bearbeiten"
                        style={{ marginTop: -2 }}
                      >
                        <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                    </div>
                  </div>

                  {/* Status-Balken */}
                  {gesamt > 0 && (
                    <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
                      {ausgefuehrt > 0 && (
                        <div style={{ flex: ausgefuehrt, background: 'var(--gruen)' }} />
                      )}
                      {teilweise > 0 && (
                        <div style={{ flex: teilweise, background: 'var(--orange)' }} />
                      )}
                      {nicht > 0 && (
                        <div style={{ flex: nicht, background: 'var(--rot)' }} />
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {ausgefuehrt > 0 && <span className="tag tag-gruen">{ausgefuehrt} ausgeführt</span>}
                    {teilweise > 0   && <span className="tag tag-orange">{teilweise} teilweise</span>}
                    {nicht > 0       && <span className="tag tag-rot">{nicht} nicht</span>}
                  </div>

                  {/* Detail-Übungen aufklappbar */}
                  <details style={{ marginTop: 10 }}>
                    <summary style={{ fontSize: '0.82rem', color: 'var(--blau)', cursor: 'pointer', userSelect: 'none' }}>
                      Details anzeigen
                    </summary>
                    <div style={{ marginTop: 8 }}>
                      {s.ergebnisse?.map(e => {
                        const sf = STATUS_FARBE[e.status] || STATUS_FARBE.nicht;
                        return (
                          <div key={e.uebungId} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 0', borderBottom: '1px solid var(--grau-m)',
                            fontSize: '0.85rem'
                          }}>
                            <span style={{ flex: 1 }}>{uebungName(e.uebungId)}</span>
                            {e.istWert && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--grau-d)' }}>
                                {e.istWert}×
                              </span>
                            )}
                            <span className={`tag ${sf.tag}`}>{sf.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                </div>
              );
            })
          )}
        </>
      )}

      {/* ===== VERGLEICH ===== */}
      {vergleichModus && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {[0, 1].map(pos => (
              <div key={pos}>
                <label style={{ fontSize: '0.8rem', color: 'var(--grau-d)', display: 'block', marginBottom: 4 }}>
                  Session {pos + 1}
                </label>
                <select
                  value={vergleichIds[pos] || ''}
                  onChange={e => vergleichSessionWaehlen(pos, e.target.value ? parseInt(e.target.value) : null)}
                  style={{
                    width: '100%', padding: '8px 10px',
                    border: '1.5px solid var(--grau-m)', borderRadius: 8,
                    fontSize: '0.82rem', background: 'var(--weiss)',
                    WebkitAppearance: 'none', appearance: 'none'
                  }}
                >
                  <option value="">– auswählen –</option>
                  {sortierteSessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {new Date(s.datum).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} – {setName(s.setId)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {session1 && session2 ? (
            <div>
              {/* Kopf-Zeile */}
              <div className="vergleich-grid" style={{ marginBottom: 8 }}>
                <div className="vergleich-spalte">
                  <div className="vergleich-datum">{formatDatum(session1.datum)}</div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{setName(session1.setId)}</div>
                </div>
                <div className="vergleich-spalte">
                  <div className="vergleich-datum">{formatDatum(session2.datum)}</div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{setName(session2.setId)}</div>
                </div>
              </div>

              {/* Übungen vergleichen */}
              {vergleichUebungsIds().map(uebungId => {
                const erg1 = session1.ergebnisse?.find(e => e.uebungId === uebungId);
                const erg2 = session2.ergebnisse?.find(e => e.uebungId === uebungId);
                const sf1  = STATUS_FARBE[erg1?.status] || STATUS_FARBE.nicht;
                const sf2  = STATUS_FARBE[erg2?.status] || STATUS_FARBE.nicht;

                return (
                  <div key={uebungId} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--grau-d)', fontWeight: 600, marginBottom: 4, padding: '0 4px' }}>
                      {uebungName(uebungId)}
                    </div>
                    <div className="vergleich-grid">
                      <div className="vergleich-spalte vergleich-zeile">
                        {erg1 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className={`tag ${sf1.tag}`}>{sf1.text}</span>
                            {erg1.istWert && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--grau-d)' }}>{erg1.istWert}×</span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--grau-d)' }}>Nicht in Session</span>
                        )}
                      </div>
                      <div className="vergleich-spalte vergleich-zeile">
                        {erg2 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className={`tag ${sf2.tag}`}>{sf2.text}</span>
                            {erg2.istWert && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--grau-d)' }}>{erg2.istWert}×</span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--grau-d)' }}>Nicht in Session</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Gesamt-Vergleich */}
              <div className="karte" style={{ marginTop: 12 }}>
                <div className="karte-titel">Gesamt-Auswertung</div>
                <div className="vergleich-grid">
                  {[session1, session2].map((s, i) => {
                    const a = s.ergebnisse?.filter(e => e.status === 'ausgefuehrt').length || 0;
                    const t = s.ergebnisse?.filter(e => e.status === 'teilweise').length || 0;
                    const n = s.ergebnisse?.filter(e => e.status === 'nicht').length || 0;
                    return (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span className="tag tag-gruen">{a} ausgeführt</span>
                        <span className="tag tag-orange">{t} teilweise</span>
                        <span className="tag tag-rot">{n} nicht</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="leer-hinweis">
              Wähle zwei Sessions aus, um sie zu vergleichen.
            </div>
          )}
        </div>
      )}

      {/* ===== MODAL: SESSION BEARBEITEN ===== */}
      {bearbeiteteSession && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && bearbeitenSchliessen()}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Training bearbeiten</div>

            <div className="feld">
              <label>Datum &amp; Uhrzeit</label>
              <input
                type="datetime-local"
                value={editDatum}
                onChange={e => setEditDatum(e.target.value)}
              />
            </div>

            <div className="feld">
              <label>Ergebnisse</label>
              {editErgebnisse.map(e => (
                <div key={e.uebungId} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 0', borderBottom: '1px solid var(--grau-m)'
                }}>
                  <span style={{ flex: 1, fontSize: '0.85rem' }}>{uebungName(e.uebungId)}</span>
                  <input
                    type="number"
                    min="0"
                    value={e.istWert || ''}
                    onChange={ev => ergebnisAendern(e.uebungId, 'istWert', ev.target.value ? parseInt(ev.target.value) : null)}
                    style={{ width: 52, padding: '4px 6px', fontSize: '0.82rem', borderRadius: 6, border: '1.5px solid var(--grau-m)', textAlign: 'center' }}
                    placeholder="Wdh."
                  />
                  <select
                    value={e.status}
                    onChange={ev => ergebnisAendern(e.uebungId, 'status', ev.target.value)}
                    style={{ fontSize: '0.8rem', padding: '4px 6px', borderRadius: 6, border: '1.5px solid var(--grau-m)', background: 'var(--weiss)' }}
                  >
                    <option value="ausgefuehrt">Ausgeführt</option>
                    <option value="teilweise">Teilweise</option>
                    <option value="nicht">Nicht</option>
                  </select>
                </div>
              ))}
            </div>

            <div className="modal-aktionen">
              <button
                className="btn btn-primaer"
                style={{ flex: 1 }}
                onClick={sessionSpeichern}
                disabled={editLadend}
              >
                Speichern
              </button>
              <button className="btn btn-hell" onClick={bearbeitenSchliessen}>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
