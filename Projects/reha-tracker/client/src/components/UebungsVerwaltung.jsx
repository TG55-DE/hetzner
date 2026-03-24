// Übungsverwaltung – Übungen anlegen und zu Sets zusammenfassen (v2)

import { useState } from 'react';

export default function UebungsVerwaltung({ uebungen, sets, onAktualisieren }) {
  const [aktiveTab, setAktiveTab] = useState('uebungen');

  // --- Übungen-State ---
  const [uebungFormOffen, setUebungFormOffen] = useState(false);
  const [bearbeiteteUebung, setBearbeiteteUebung] = useState(null);
  const [uName, setUName] = useState('');
  const [uWiederholungen, setUWiederholungen] = useState('');
  const [uZyklen, setUZyklen] = useState('');
  const [uMinuten, setUMinuten] = useState('');
  const [uNotiz, setUNotiz] = useState('');

  // --- Sets-State ---
  const [setFormOffen, setSetFormOffen] = useState(false);
  const [sName, setSName] = useState('');
  const [sUebungsIds, setSUebungsIds] = useState([]);
  const [bearbeitesSet, setBearbeitesSet] = useState(null); // zum Bearbeiten
  const [aufgeklapptesets, setAufgeklapptesets] = useState({}); // Collapsible-State
  const [zuLoeschendeUebungId, setZuLoeschendeUebungId] = useState(null);
  const [zuLoeschendesSetId, setZuLoeschendesSetId] = useState(null);

  // --- Übung-Formular öffnen ---
  function uebungFormOeffnen(uebung = null) {
    if (uebung) {
      setBearbeiteteUebung(uebung);
      setUName(uebung.name);
      setUWiederholungen(uebung.wiederholungen ? String(uebung.wiederholungen) : '');
      setUZyklen(uebung.zyklen ? String(uebung.zyklen) : '');
      setUMinuten(uebung.minuten ? String(uebung.minuten) : '');
      setUNotiz(uebung.notiz || '');
    } else {
      setBearbeiteteUebung(null);
      setUName(''); setUWiederholungen(''); setUZyklen(''); setUMinuten(''); setUNotiz('');
    }
    setUebungFormOffen(true);
  }

  // --- Übung speichern (neu oder bearbeiten) ---
  async function uebungSpeichern() {
    if (!uName) return;
    const payload = {
      name: uName,
      wiederholungen: uWiederholungen ? parseInt(uWiederholungen) : null,
      zyklen: uZyklen ? parseInt(uZyklen) : null,
      minuten: uMinuten ? parseFloat(uMinuten) : null,
      notiz: uNotiz,
    };
    if (bearbeiteteUebung) {
      await fetch(`/api/uebungen/${bearbeiteteUebung.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch('/api/uebungen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    setUName(''); setUWiederholungen(''); setUZyklen(''); setUMinuten(''); setUNotiz('');
    setBearbeiteteUebung(null);
    setUebungFormOffen(false);
    onAktualisieren();
  }

  async function uebungLoeschen(id) {
    await fetch(`/api/uebungen/${id}`, { method: 'DELETE' });
    onAktualisieren();
  }

  // --- Set speichern (neu oder bearbeiten) ---
  async function setSpeichern() {
    if (!sName) return;
    if (bearbeitesSet) {
      // Bestehenden Set aktualisieren
      await fetch(`/api/sets/${bearbeitesSet.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sName, uebungsIds: sUebungsIds }),
      });
    } else {
      // Neuen Set anlegen
      await fetch('/api/sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sName, uebungsIds: sUebungsIds }),
      });
    }
    setSName(''); setSUebungsIds([]); setSetFormOffen(false); setBearbeitesSet(null);
    onAktualisieren();
  }

  function setBearbeiten(set) {
    setBearbeitesSet(set);
    setSName(set.name);
    setSUebungsIds([...set.uebungsIds]);
    setSetFormOffen(true);
  }

  async function setLoeschen(id) {
    await fetch(`/api/sets/${id}`, { method: 'DELETE' });
    onAktualisieren();
  }

  function toggleUebungInSet(id) {
    setSUebungsIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  // Vorgaben-Text für eine Übung
  function vorgabenText(u) {
    const teile = [];
    if (u.wiederholungen) teile.push(`${u.wiederholungen}×`);
    if (u.zyklen)         teile.push(`${u.zyklen} Zyklen`);
    if (u.minuten)        teile.push(`${u.minuten} Pause`);
    return teile.length ? teile.join(' · ') : 'Keine Vorgabe';
  }

  return (
    <div>
      {/* Sub-Navigation */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className={`btn${aktiveTab === 'uebungen' ? ' btn-primaer' : ' btn-hell'}`}
          style={{ flex: 1 }}
          onClick={() => setAktiveTab('uebungen')}
        >
          Übungen
        </button>
        <button
          className={`btn${aktiveTab === 'sets' ? ' btn-primaer' : ' btn-hell'}`}
          style={{ flex: 1 }}
          onClick={() => setAktiveTab('sets')}
        >
          Sets
        </button>
      </div>

      {/* ===== ÜBUNGEN ===== */}
      {aktiveTab === 'uebungen' && (
        <>
          <button
            className="btn btn-primaer btn-voll"
            style={{ marginBottom: 16 }}
            onClick={() => uebungFormOeffnen()}
          >
            <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Neue Übung anlegen
          </button>

          {uebungen.length === 0 ? (
            <div className="leer-hinweis">Noch keine Übungen angelegt</div>
          ) : (
            uebungen.map(u => (
              <div key={u.id} className="liste-eintrag">
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: 'var(--blau)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="#fff" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 4v6M6 14v6M18 4v6M18 14v6M3 10h6M15 10h6M3 14h6M15 14h6"/>
                  </svg>
                </div>
                <div className="liste-eintrag-info">
                  <div className="liste-eintrag-titel">{u.name}</div>
                  <div className="liste-eintrag-meta">{vorgabenText(u)}</div>
                  {u.notiz && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--grau-d)', marginTop: 2 }}>{u.notiz}</div>
                  )}
                </div>
                <div className="liste-eintrag-aktionen">
                  <button
                    className="icon-btn"
                    onClick={() => uebungFormOeffnen(u)}
                    title="Bearbeiten"
                  >
                    <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button
                    className="icon-btn gefahr"
                    onClick={() => setZuLoeschendeUebungId(u.id)}
                    title="Löschen"
                  >
                    <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* ===== SETS ===== */}
      {aktiveTab === 'sets' && (
        <>
          <button
            className="btn btn-primaer btn-voll"
            style={{ marginBottom: 16 }}
            onClick={() => { setBearbeitesSet(null); setSName(''); setSUebungsIds([]); setSetFormOffen(true); }}
          >
            <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Neues Set anlegen
          </button>

          {sets.length === 0 ? (
            <div className="leer-hinweis">Noch keine Sets angelegt</div>
          ) : (
            sets.map(s => {
              const setUebungen = (s.uebungsIds || [])
                .map(id => uebungen.find(u => u.id === id))
                .filter(Boolean);
              return (
                <div key={s.id} className="karte">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem' }}>{s.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--grau-d)', marginTop: 2 }}>
                        {setUebungen.length} Übung{setUebungen.length !== 1 ? 'en' : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="icon-btn"
                        onClick={() => setBearbeiten(s)}
                        title="Bearbeiten"
                      >
                        <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button
                        className="icon-btn gefahr"
                        onClick={() => setZuLoeschendesSetId(s.id)}
                        title="Löschen"
                      >
                        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      </button>
                    </div>
                  </div>
                  {setUebungen.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <button
                        onClick={() => setAufgeklapptesets(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                        style={{
                          background: 'none', border: 'none', padding: '4px 0',
                          fontSize: '0.82rem', color: 'var(--blau)', cursor: 'pointer',
                          userSelect: 'none', display: 'flex', alignItems: 'center', gap: 4
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="var(--blau)" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          style={{ transform: aufgeklapptesets[s.id] ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                        {aufgeklapptesets[s.id] ? 'Details verbergen' : 'Details anzeigen'}
                      </button>
                      {aufgeklapptesets[s.id] && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                          {setUebungen.map((u, i) => (
                            <div key={u.id} style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '6px 10px', background: 'var(--grau-h)',
                              borderRadius: 8, fontSize: '0.85rem'
                            }}>
                              <span style={{ color: 'var(--grau-d)', fontWeight: 600, minWidth: 20 }}>{i + 1}.</span>
                              <span style={{ flex: 1 }}>{u.name}</span>
                              <span style={{ color: 'var(--grau-d)', fontSize: '0.75rem' }}>{vorgabenText(u)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </>
      )}

      {/* ===== MODAL: ÜBUNG ANLEGEN / BEARBEITEN ===== */}
      {uebungFormOffen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setUebungFormOffen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">
              {bearbeiteteUebung ? 'Übung bearbeiten' : 'Neue Übung anlegen'}
            </div>

            <div className="feld">
              <label>Name der Übung*</label>
              <input
                type="text"
                value={uName}
                onChange={e => setUName(e.target.value)}
                placeholder="z.B. Kniebeugen"
                autoFocus
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div className="feld">
                <label>Wdh.</label>
                <input
                  type="number"
                  min="1"
                  value={uWiederholungen}
                  onChange={e => setUWiederholungen(e.target.value)}
                  placeholder="z.B. 10"
                />
              </div>
              <div className="feld">
                <label>Zyklen</label>
                <input
                  type="number"
                  min="1"
                  value={uZyklen}
                  onChange={e => setUZyklen(e.target.value)}
                  placeholder="z.B. 3"
                />
              </div>
              <div className="feld">
                <label>Pause</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={uMinuten}
                  onChange={e => setUMinuten(e.target.value)}
                  placeholder="z.B. 2"
                />
              </div>
            </div>

            <div className="feld">
              <label>Notiz (optional)</label>
              <textarea
                rows={2}
                value={uNotiz}
                onChange={e => setUNotiz(e.target.value)}
                placeholder="z.B. Ausführungshinweise…"
              />
            </div>

            <div className="modal-aktionen">
              <button
                className="btn btn-primaer"
                style={{ flex: 1 }}
                onClick={uebungSpeichern}
                disabled={!uName}
              >
                Speichern
              </button>
              <button className="btn btn-hell" onClick={() => { setUebungFormOffen(false); setBearbeiteteUebung(null); }}>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL: SET ANLEGEN / BEARBEITEN ===== */}
      {setFormOffen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSetFormOffen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">
              {bearbeitesSet ? 'Set bearbeiten' : 'Neues Set anlegen'}
            </div>

            <div className="feld">
              <label>Name des Sets*</label>
              <input
                type="text"
                value={sName}
                onChange={e => setSName(e.target.value)}
                placeholder="z.B. Morgenroutine"
                autoFocus
              />
            </div>

            <div className="feld">
              <label>Übungen auswählen</label>
              {uebungen.length === 0 ? (
                <div style={{ color: 'var(--grau-d)', fontSize: '0.85rem', padding: '8px 0' }}>
                  Zuerst Übungen anlegen (Tab "Übungen")
                </div>
              ) : (
                <div className="checkbox-liste">
                  {uebungen.map(u => (
                    <label
                      key={u.id}
                      className={`checkbox-eintrag${sUebungsIds.includes(u.id) ? ' checked' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={sUebungsIds.includes(u.id)}
                        onChange={() => toggleUebungInSet(u.id)}
                        style={{ display: 'none' }}
                      />
                      <span className="custom-checkbox">
                        {sUebungsIds.includes(u.id) && (
                          <svg viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <polyline points="1,5 4.5,9 11,1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </span>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{u.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--grau-d)' }}>{vorgabenText(u)}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-aktionen">
              <button
                className="btn btn-primaer"
                style={{ flex: 1 }}
                onClick={setSpeichern}
                disabled={!sName}
              >
                Speichern
              </button>
              <button className="btn btn-hell" onClick={() => { setSetFormOffen(false); setBearbeitesSet(null); }}>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

    {/* Bestätigungsdialog: Übung löschen */}
    {zuLoeschendeUebungId && (
      <div className="modal-overlay" onClick={() => setZuLoeschendeUebungId(null)}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 320 }}>
          <div className="modal-titel">Wirklich löschen?</div>
          <p style={{ margin: '12px 0 20px', color: 'var(--grau-d)', fontSize: '0.9rem' }}>
            Diese Übung wird dauerhaft gelöscht und kann nicht wiederhergestellt werden.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn btn-gefahr"
              style={{ flex: 1 }}
              onClick={() => { uebungLoeschen(zuLoeschendeUebungId); setZuLoeschendeUebungId(null); }}
            >
              Ja, löschen
            </button>
            <button className="btn btn-hell" onClick={() => setZuLoeschendeUebungId(null)}>
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Bestätigungsdialog: Set löschen */}
    {zuLoeschendesSetId && (
      <div className="modal-overlay" onClick={() => setZuLoeschendesSetId(null)}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 320 }}>
          <div className="modal-titel">Wirklich löschen?</div>
          <p style={{ margin: '12px 0 20px', color: 'var(--grau-d)', fontSize: '0.9rem' }}>
            Dieses Set wird dauerhaft gelöscht und kann nicht wiederhergestellt werden.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn btn-gefahr"
              style={{ flex: 1 }}
              onClick={() => { setLoeschen(zuLoeschendesSetId); setZuLoeschendesSetId(null); }}
            >
              Ja, löschen
            </button>
            <button className="btn btn-hell" onClick={() => setZuLoeschendesSetId(null)}>
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
