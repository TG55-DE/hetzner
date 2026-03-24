# Reha-Tracker — Projekt-CLAUDE.md

## Überblick
Trainings- und Schmerz-Tagebuch für Reha-Übungen.
React-Frontend mit Express-Backend und JSON-Datenspeicher.

## Technologie
- **Backend:** Express 4 + Node.js
- **Frontend:** React 19 + Vite (gebaut nach public/)
- **Datenspeicher:** JSON-Datei (`data/tracker.json`) — keine Datenbank
- **Auth:** Keine (bewusst offen, kein sensibler Inhalt)

## Struktur
```
reha-tracker/
├── ecosystem.config.js    ← PM2-Konfiguration
├── server.js              ← Express-Server (Port 3002)
├── client/                ← React-Quellcode
│   ├── src/
│   │   ├── App.jsx
│   │   └── components/
│   │       ├── Dashboard.jsx
│   │       ├── SchmerzTagebuch.jsx
│   │       ├── SessionVerlauf.jsx
│   │       ├── Termine.jsx
│   │       ├── TrainingsSession.jsx
│   │       └── UebungsVerwaltung.jsx
│   └── vite.config.js
├── public/                ← Gebautes Frontend (Vite-Output)
│   └── assets/
├── data/
│   └── tracker.json       ← Alle Daten (Übungen, Sessions, Schmerz)
└── server.js
```

## Wichtig
- **Daten liegen in `data/tracker.json`** — NIEMALS diese Datei löschen
- Kein Login, kein Auth — App ist für einen eingeschränkten Nutzerkreis
- PM2-Name: `reha-tracker`

## Build & Deploy
```bash
cd client && npm run build    # Baut nach ../public/
pm2 restart reha-tracker
```

## HTTPS
- Intern: Port 3002
- Extern: https://91.99.56.96:9443 (Caddy)
