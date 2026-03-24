#!/bin/bash
# Deploy-Script für Meditation
set -e
cd /home/timo_hahn/Timos_CC_Projekte/meditation

echo "=== Meditation Deploy ==="

# Kein Build nötig (Vanilla HTML/JS)
# PM2 neustarten
echo "→ PM2 neustarten..."
pm2 restart meditation-app

echo "✓ Meditation deployed!"
