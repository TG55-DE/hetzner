# CC Extension — Projekt-CLAUDE.md

## Überblick
Mobile PWA-Frontend zur Steuerung von Claude Code vom iPhone.
Dies ist die Haupt-App — alle anderen Apps werden hierüber erstellt/gesteuert.

## Technologie
- **Backend:** Express 5 + Node.js (kein TypeScript)
- **Frontend:** React 19 + Vite 8 (gebaut nach backend/public/)
- **Datenbank:** PostgreSQL 16 (DB: ccextension, User: ccextension)
- **Cache/Queue:** Redis + BullMQ (Worker-Prozess für Claude-Code-Aufrufe)
- **Auth:** bcryptjs + JWT
- **WebSocket:** ws (Echtzeit-Chat)
- **APIs:** Anthropic SDK (Claude), OpenAI SDK (Whisper Transcription)

## Struktur
```
cc-extension/
├── backend/
│   ├── ecosystem.config.js      ← PM2-Konfiguration
│   ├── src/
│   │   ├── index.js             ← Express-Server (Port 3000)
│   │   ├── worker-process.js    ← BullMQ-Worker
│   │   ├── models/db.js         ← PostgreSQL-Pool
│   │   ├── routes/              ← API-Endpunkte
│   │   └── services/
│   │       ├── claude-code.js   ← Claude CLI Aufruf (DEFAULT_WORK_DIR!)
│   │       ├── websocket.js     ← WebSocket-Server
│   │       └── worker.js        ← Job-Queue
│   └── public/                  ← Gebautes Frontend (Vite-Output)
└── frontend/
    └── src/                     ← React-Quellcode
```

## Wichtige Konfiguration
- `backend/.env` enthält: PORT, DATABASE_URL, REDIS_URL, JWT_SECRET, ANTHROPIC_API_KEY, OPENAI_API_KEY
- `DEFAULT_WORK_DIR` in claude-code.js = `/home/timo_hahn/Timos_CC_Projekte` (NICHT ändern!)
- Backend hat 2 PM2-Prozesse: `cc-extension-backend` + `cc-extension-worker`

## Build & Deploy
```bash
cd frontend && npm run build    # Baut nach backend/public/
pm2 restart cc-extension-backend cc-extension-worker
```

## HTTPS
- Intern: Port 3000
- Extern: https://91.99.56.96 (Caddy Port 443)
- WebSocket-Unterstützung in Caddy konfiguriert (flush_interval, read_timeout)
