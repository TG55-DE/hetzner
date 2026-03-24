#!/bin/bash
# Deploy-Script für Reha-Tracker
set -e
cd /home/timo_hahn/Timos_CC_Projekte/reha-tracker

echo "=== Reha-Tracker Deploy ==="

# Frontend bauen
echo "→ Frontend bauen..."
cd client && npm run build && cd ..

# PM2 neustarten
echo "→ PM2 neustarten..."
pm2 restart reha-tracker

echo "✓ Reha-Tracker deployed!"
