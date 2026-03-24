# CC Extension – Persönlicher AI Developer Agent

## Was ist das?
Eine PWA (Web-App) auf deinem iPhone, über die du per Sprache oder Text Befehle gibst, und Claude Code auf dem VPS selbstständig Apps baut und deployed.

## Erster Start

### 1. API Key eintragen
```bash
nano /home/timo_hahn/Timos_CC_Projekte/cc-extension/backend/.env
```
Den Wert `HIER_API_KEY_EINTRAGEN` durch deinen Anthropic API Key ersetzen.

### 2. JWT-Secret ändern
In der gleichen `.env` Datei den Wert `BITTE_AENDERN_langer_geheimer_schluessel_2026` durch einen langen zufälligen Text ersetzen.

### 3. Services neustarten
```bash
sudo systemctl restart cc-extension-backend cc-extension-worker
```

### 4. PWA auf dem iPhone öffnen
Öffne Safari und gehe zu: **http://91.99.56.96:3000**

Dann: Teilen-Button → "Zum Home-Bildschirm" → App ist wie eine native App installiert!

---

## Services verwalten

```bash
# Status aller CC Extension Services
sudo systemctl status cc-extension-backend
sudo systemctl status cc-extension-worker

# Neustart
sudo systemctl restart cc-extension-backend
sudo systemctl restart cc-extension-worker

# Logs anzeigen
tail -f /home/timo_hahn/Timos_CC_Projekte/cc-extension/backend/logs/backend.log
tail -f /home/timo_hahn/Timos_CC_Projekte/cc-extension/backend/logs/worker.log
```

## Frontend neu bauen (nach Code-Änderungen)

```bash
cd /home/timo_hahn/Timos_CC_Projekte/cc-extension/frontend
npm run build
# PWA-Dateien kopieren
cp public/sw.js public/manifest.json public/icon-*.png ../backend/public/
sudo systemctl restart cc-extension-backend
```

## Ports
| Service | Port |
|---------|------|
| CC Extension PWA | 3000 |
| Erste gebaute App | 3001 |
| Zweite gebaute App | 3002 |
| ... | ... |

## Architektur
```
iPhone (Safari/PWA)
    ↓ HTTP/WebSocket
Backend (Express, Port 3000)
    ├── /api/auth    – Login/Registrierung
    ├── /api/chat    – Chat mit Claude + Streaming
    ├── /api/conversations – Chat-Historie
    ├── /api/apps    – Deployed Apps
    └── /ws          – WebSocket (Echtzeit-Updates)
         ↓
Worker (BullMQ + Redis)
    └── Claude Code (baut Apps)
         └── deployments/[app-name]/ (Port 3001, 3002, ...)
```
