#!/bin/bash
# deploy.sh – CC Extension neu bauen und neustarten
# Führt alle nötigen Schritte durch: Build, PM2 restart, Logs prüfen
# Verwendung: ./deploy.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "=== CC Extension Deploy ==="
echo "Verzeichnis: $SCRIPT_DIR"

# ---- 1. Logs-Ordner sicherstellen ----
LOG_DIR="/home/timo_hahn/Timos_CC_Projekte/hetzner/logs"
mkdir -p "$LOG_DIR"
echo "✓ Logs-Ordner: $LOG_DIR"

# ---- 2. Backend-Abhängigkeiten aktualisieren ----
echo ""
echo "📦 Backend: npm install..."
cd "$SCRIPT_DIR/backend"
npm install --production

# ---- 3. Frontend bauen ----
echo ""
echo "🏗️  Frontend: npm install & build..."
cd "$SCRIPT_DIR/frontend"
npm install
npm run build

# ---- 4. Gebautes Frontend ins Backend-Public kopieren ----
echo ""
echo "📋 Frontend nach Backend/public kopieren..."
rm -rf "$SCRIPT_DIR/backend/public"
cp -r "$SCRIPT_DIR/frontend/dist" "$SCRIPT_DIR/backend/public"
echo "✓ Frontend deployed nach: $SCRIPT_DIR/backend/public"

# ---- 5. PM2 prüfen und starten ----
echo ""
echo "🚀 PM2: Backend und Worker starten..."
cd "$SCRIPT_DIR/backend"

if command -v pm2 &> /dev/null; then
    # Prüfen ob bereits PM2-Prozesse laufen
    if pm2 list | grep -q "cc-extension"; then
        echo "   Prozesse werden neugestartet..."
        pm2 restart ecosystem.config.js
    else
        echo "   Prozesse werden erstmalig gestartet..."
        pm2 start ecosystem.config.js
        # PM2 so einrichten, dass es nach Reboot automatisch startet
        pm2 save
        echo ""
        echo "   ⚠️  Für Auto-Start nach Reboot einmalig ausführen:"
        echo "   pm2 startup"
    fi
    echo "✓ PM2 Status:"
    pm2 list
else
    echo "   ⚠️  PM2 nicht gefunden! Installieren mit: npm install -g pm2"
    echo "   Starte Server manuell..."
    # Fallback: systemd-Service neustarten (falls vorhanden)
    if systemctl is-active --quiet cc-extension-backend 2>/dev/null; then
        sudo systemctl restart cc-extension-backend cc-extension-worker
        echo "✓ systemd-Services neugestartet"
    else
        echo "   Bitte manuell starten: node src/index.js"
    fi
fi

# ---- 6. Fertig ----
echo ""
echo "=== ✅ Deploy abgeschlossen ==="
echo "Die CC Extension ist erreichbar unter: https://91.99.56.96"
echo ""
echo "Logs anzeigen mit: pm2 logs cc-extension-backend"
