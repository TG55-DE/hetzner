# Meditation — Projekt-CLAUDE.md

## Überblick
Timer-App für geführte Meditation mit Gong-Sounds.
Einfache PWA, läuft als Vanilla HTML/JS (kein React).

## Technologie
- **Backend:** Express 4 + Node.js
- **Frontend:** Vanilla HTML/JS/CSS (kein Build-Schritt)
- **Datenbank:** PostgreSQL (Session-Daten)
- **Auth:** bcrypt + JWT + express-session + Cookies

## Struktur
```
meditation/
├── ecosystem.config.js    ← PM2-Konfiguration
├── server.js              ← Express-Server (Port 3001)
├── .env                   ← DB-Credentials, SESSION_SECRET
└── public/
    ├── index.html         ← Komplette App (Single Page)
    └── sounds/
        ├── Gong_deep.mp3
        ├── Gong_high.mp3
        └── Gong_mid.mp3
```

## Wichtig
- Kein Build-Schritt nötig — Frontend wird direkt als statische Dateien serviert
- Audio-Dateien in public/sounds/ — Gong-Sounds für Meditation-Timer
- PM2-Name: `meditation-app`

## Build & Deploy
```bash
# Kein Build nötig – einfach neu starten
pm2 restart meditation-app
```

## HTTPS
- Intern: Port 3001
- Extern: https://91.99.56.96:8443 (Caddy)
