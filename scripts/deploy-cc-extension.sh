#!/bin/bash
# Deploy-Script für CC Extension
set -e
cd /home/timo_hahn/Timos_CC_Projekte/Projects/cc-extension

echo "=== CC Extension Deploy ==="

# Frontend bauen
echo "→ Frontend bauen..."
cd frontend && npm run build && cd ..

# Gebaute Dateien ins Backend kopieren
echo "→ Build-Dateien kopieren..."
rm -rf backend/public/assets
cp -r frontend/dist/* backend/public/

# PM2 neustarten
echo "→ PM2 neustarten..."
pm2 restart cc-extension-backend cc-extension-worker

echo "✓ CC Extension deployed!"
