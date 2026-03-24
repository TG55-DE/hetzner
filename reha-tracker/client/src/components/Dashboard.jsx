// Dashboard – Übersicht über alle wichtigen Kennzahlen

export default function Dashboard({ daten, onAktualisieren, onTabWechsel }) {
  const { eintraege = [], termine = [], uebungen = [], sets = [], sessions = [] } = daten;

  // Letzter Schmerz-Eintrag
  const letzterEintrag = eintraege[0];

  // Durchschnittlicher Schmerz der letzten 7 Tage
  const vor7Tagen = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const eintraegeLetzte7Tage = eintraege.filter(e => new Date(e.datum) > vor7Tagen);
  const durchschnittSchmerz = eintraegeLetzte7Tage.length > 0
    ? (eintraegeLetzte7Tage.reduce((s, e) => s + e.schmerz, 0) / eintraegeLetzte7Tage.length).toFixed(1)
    : '–';

  // Nächster Termin
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  const naechsterTermin = termine.find(t => new Date(t.datum) >= heute);

  // Letzte Session
  const letzteSession = sessions[sessions.length - 1];

  function formatDatum(isoStr) {
    return new Date(isoStr).toLocaleDateString('de-DE', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  function schmerzFarbe(wert) {
    if (wert <= 3) return 'var(--gruen)';
    if (wert <= 6) return 'var(--orange)';
    return 'var(--rot)';
  }

  return (
    <div>
      {/* Statistiken */}
      <div className="karte">
        <div className="karte-titel">Statistiken</div>
        <div className="stats-grid">
          <div className="stat-karte">
            <div className="stat-zahl">{eintraege.length}</div>
            <div className="stat-label">Einträge gesamt</div>
          </div>
          <div className="stat-karte">
            <div className="stat-zahl" style={{ color: durchschnittSchmerz !== '–' ? schmerzFarbe(parseFloat(durchschnittSchmerz)) : undefined }}>
              {durchschnittSchmerz}
            </div>
            <div className="stat-label">⌀ Schmerz (7 Tage)</div>
          </div>
          <div className="stat-karte">
            <div className="stat-zahl">{sets.length}</div>
            <div className="stat-label">Übungs-Sets</div>
          </div>
          <div className="stat-karte">
            <div className="stat-zahl">{sessions.length}</div>
            <div className="stat-label">Trainings gesamt</div>
          </div>
        </div>
      </div>

      {/* Letzter Schmerz-Eintrag */}
      {letzterEintrag && (
        <div className="karte">
          <div className="karte-titel">Letzter Schmerz-Eintrag</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: schmerzFarbe(letzterEintrag.schmerz),
              color: '#fff', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontWeight: 700, fontSize: '1.3rem',
              flexShrink: 0
            }}>
              {letzterEintrag.schmerz}
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>{letzterEintrag.ort || 'Allgemein'}</div>
              {letzterEintrag.stimmung && (
                <div style={{ fontSize: '0.82rem', color: 'var(--grau-d)' }}>
                  Stimmung: {letzterEintrag.stimmung}
                </div>
              )}
              <div style={{ fontSize: '0.78rem', color: 'var(--grau-d)', marginTop: 2 }}>
                {formatDatum(letzterEintrag.datum)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nächster Termin */}
      {naechsterTermin ? (
        <div className="karte">
          <div className="karte-titel">Nächster Termin</div>
          <div style={{ fontWeight: 600 }}>{naechsterTermin.titel}</div>
          {naechsterTermin.ort && (
            <div style={{ fontSize: '0.85rem', color: 'var(--grau-d)', marginTop: 3 }}>
              {naechsterTermin.ort}
            </div>
          )}
          <div style={{ fontSize: '0.82rem', color: 'var(--blau)', marginTop: 4, fontWeight: 500 }}>
            {formatDatum(naechsterTermin.datum)}
            {naechsterTermin.uhrzeit && ` um ${naechsterTermin.uhrzeit} Uhr`}
          </div>
        </div>
      ) : (
        <div className="karte">
          <div className="karte-titel">Nächster Termin</div>
          <div className="leer-hinweis" style={{ padding: '12px 0' }}>Keine anstehenden Termine</div>
        </div>
      )}

      {/* Letzte Trainings-Session */}
      {letzteSession ? (
        <div className="karte">
          <div className="karte-titel">Letztes Training</div>
          <div style={{ fontWeight: 600 }}>
            {sets.find(s => s.id === letzteSession.setId)?.name || 'Unbekanntes Set'}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--grau-d)', marginTop: 3 }}>
            {formatDatum(letzteSession.datum)} &middot; {letzteSession.ergebnisse?.length || 0} Übungen
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {(() => {
              const ausgefuehrt = letzteSession.ergebnisse?.filter(e => e.status === 'ausgefuehrt').length || 0;
              const teilweise   = letzteSession.ergebnisse?.filter(e => e.status === 'teilweise').length || 0;
              const nicht       = letzteSession.ergebnisse?.filter(e => e.status === 'nicht').length || 0;
              return (
                <>
                  {ausgefuehrt > 0 && <span className="tag tag-gruen">{ausgefuehrt} ausgeführt</span>}
                  {teilweise   > 0 && <span className="tag tag-orange">{teilweise} teilweise</span>}
                  {nicht       > 0 && <span className="tag tag-rot">{nicht} nicht</span>}
                </>
              );
            })()}
          </div>
        </div>
      ) : (
        <div className="karte">
          <div className="karte-titel">Training</div>
          <div className="leer-hinweis" style={{ padding: '12px 0' }}>Noch kein Training durchgeführt</div>
          <button className="btn btn-primaer btn-voll" onClick={() => onTabWechsel('training')}>
            <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Jetzt starten
          </button>
        </div>
      )}
    </div>
  );
}
