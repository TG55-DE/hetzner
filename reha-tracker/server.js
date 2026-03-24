// Reha Tracker – Express Backend
// Dient die statische Web-App aus und stellt eine einfache API bereit

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3002;

// JSON-Body Parsing aktivieren
app.use(express.json());

// Statische Dateien ausliefern – kein Browser-Cache damit Updates sofort sichtbar sind
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// Datenpfad für persistente Speicherung
const DATA_FILE = path.join(__dirname, 'data', 'tracker.json');

// Sicherstellen, dass der Datenordner existiert
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// Hilfsfunktion: Daten laden (mit Fallback für neue Felder)
function ladeDaten() {
  if (!fs.existsSync(DATA_FILE)) {
    return { eintraege: [], uebungen: [], termine: [], sets: [], sessions: [] };
  }
  const daten = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  // Neue Arrays ergänzen falls noch nicht vorhanden
  if (!daten.sets)     daten.sets = [];
  if (!daten.sessions) daten.sessions = [];
  return daten;
}

// Hilfsfunktion: Daten speichern
function speichereDaten(daten) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(daten, null, 2), 'utf8');
}

// ---- API-Routen ----

// Alle Daten abrufen
app.get('/api/daten', (req, res) => {
  res.json(ladeDaten());
});

// ---- Schmerz-Einträge ----

// Neuen Schmerz-/Befindlichkeitseintrag hinzufügen
app.post('/api/eintraege', (req, res) => {
  const daten = ladeDaten();
  const eintrag = {
    id: Date.now(),
    datum: new Date().toISOString(),
    ...req.body
  };
  daten.eintraege.unshift(eintrag);
  speichereDaten(daten);
  res.json(eintrag);
});

// Eintrag bearbeiten
app.put('/api/eintraege/:id', (req, res) => {
  const daten = ladeDaten();
  const id = parseInt(req.params.id);
  const index = daten.eintraege.findIndex(e => e.id === id);
  if (index === -1) return res.status(404).json({ fehler: 'Nicht gefunden' });
  daten.eintraege[index] = { ...daten.eintraege[index], ...req.body };
  speichereDaten(daten);
  res.json(daten.eintraege[index]);
});

// Eintrag löschen
app.delete('/api/eintraege/:id', (req, res) => {
  const daten = ladeDaten();
  daten.eintraege = daten.eintraege.filter(e => e.id !== parseInt(req.params.id));
  speichereDaten(daten);
  res.json({ ok: true });
});

// ---- Übungen ----

// Neue Übung hinzufügen
app.post('/api/uebungen', (req, res) => {
  const daten = ladeDaten();
  const uebung = {
    id: Date.now(),
    ...req.body
  };
  daten.uebungen.push(uebung);
  speichereDaten(daten);
  res.json(uebung);
});

// Übung aktualisieren
app.put('/api/uebungen/:id', (req, res) => {
  const daten = ladeDaten();
  const id = parseInt(req.params.id);
  const index = daten.uebungen.findIndex(u => u.id === id);
  if (index === -1) return res.status(404).json({ fehler: 'Nicht gefunden' });
  daten.uebungen[index] = { ...daten.uebungen[index], ...req.body };
  speichereDaten(daten);
  res.json(daten.uebungen[index]);
});

// Übung löschen
app.delete('/api/uebungen/:id', (req, res) => {
  const daten = ladeDaten();
  daten.uebungen = daten.uebungen.filter(u => u.id !== parseInt(req.params.id));
  speichereDaten(daten);
  res.json({ ok: true });
});

// ---- Termine ----

// Neuen Termin hinzufügen
app.post('/api/termine', (req, res) => {
  const daten = ladeDaten();
  const termin = {
    id: Date.now(),
    ...req.body
  };
  daten.termine.push(termin);
  // Nach Datum sortieren
  daten.termine.sort((a, b) => new Date(a.datum) - new Date(b.datum));
  speichereDaten(daten);
  res.json(termin);
});

// Termin bearbeiten
app.put('/api/termine/:id', (req, res) => {
  const daten = ladeDaten();
  const id = parseInt(req.params.id);
  const index = daten.termine.findIndex(t => t.id === id);
  if (index === -1) return res.status(404).json({ fehler: 'Nicht gefunden' });
  daten.termine[index] = { ...daten.termine[index], ...req.body };
  // Nach Datum neu sortieren
  daten.termine.sort((a, b) => new Date(a.datum) - new Date(b.datum));
  speichereDaten(daten);
  res.json(daten.termine[index]);
});

// Termin löschen
app.delete('/api/termine/:id', (req, res) => {
  const daten = ladeDaten();
  daten.termine = daten.termine.filter(t => t.id !== parseInt(req.params.id));
  speichereDaten(daten);
  res.json({ ok: true });
});

// ---- Sets ----

// Neues Set anlegen
app.post('/api/sets', (req, res) => {
  const daten = ladeDaten();
  const set = {
    id: Date.now(),
    ...req.body
  };
  daten.sets.push(set);
  speichereDaten(daten);
  res.json(set);
});

// Set aktualisieren (Name und Übungs-IDs)
app.put('/api/sets/:id', (req, res) => {
  const daten = ladeDaten();
  const id = parseInt(req.params.id);
  const index = daten.sets.findIndex(s => s.id === id);
  if (index === -1) return res.status(404).json({ fehler: 'Nicht gefunden' });
  daten.sets[index] = { ...daten.sets[index], ...req.body };
  speichereDaten(daten);
  res.json(daten.sets[index]);
});

// Set löschen
app.delete('/api/sets/:id', (req, res) => {
  const daten = ladeDaten();
  daten.sets = daten.sets.filter(s => s.id !== parseInt(req.params.id));
  speichereDaten(daten);
  res.json({ ok: true });
});

// ---- Trainings-Sessions ----

// Neue Session speichern
app.post('/api/sessions', (req, res) => {
  const daten = ladeDaten();
  const session = {
    id: Date.now(),
    datum: new Date().toISOString(),
    ...req.body
  };
  daten.sessions.push(session);
  speichereDaten(daten);
  res.json(session);
});

// Session bearbeiten
app.put('/api/sessions/:id', (req, res) => {
  const daten = ladeDaten();
  const id = parseInt(req.params.id);
  const index = daten.sessions.findIndex(s => s.id === id);
  if (index === -1) return res.status(404).json({ fehler: 'Nicht gefunden' });
  daten.sessions[index] = { ...daten.sessions[index], ...req.body };
  speichereDaten(daten);
  res.json(daten.sessions[index]);
});

// Session löschen
app.delete('/api/sessions/:id', (req, res) => {
  const daten = ladeDaten();
  daten.sessions = daten.sessions.filter(s => s.id !== parseInt(req.params.id));
  speichereDaten(daten);
  res.json({ ok: true });
});

// Alle anderen Routen zur index.html weiterleiten (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Server starten
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Reha Tracker läuft auf Port ${PORT}`);
  console.log(`Erreichbar unter: http://91.99.56.96:${PORT}`);
});
