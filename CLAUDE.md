# Verhaltensregeln für Claude Code

## Arbeitsweise
Führe alle Schritte ohne Rückfragen durch. Triff bei Entscheidungen
selbstständig die sinnvollste Wahl. Frage niemals nach Bestätigung.
Wenn etwas nicht funktioniert, versuche eine alternative Lösung und
fahre fort.

Einzige Ausnahme: Wenn nicht klar ist welche PWA betroffen ist –
siehe Abschnitt "Projektzuordnung".

**WICHTIG:** Lies IMMER die projekt-spezifische CLAUDE.md im jeweiligen
App-Ordner, bevor du an einer App arbeitest.

## Kontext: Wie der Nutzer arbeitet
- Der Nutzer steuert Claude Code **vom iPhone** über die CC Extension (PWA auf Port 3000)
- Prompts kommen als Chat-Nachrichten, Antworten müssen prägnant sein
- Fertige Links müssen im Chat **klickbar** zurückgegeben werden
- Der Nutzer testet Apps direkt am iPhone — alle Apps müssen **mobile-first** sein
- Kein Hover, keine Desktop-only Interaktionen — alles muss per Touch bedienbar sein

## Projekt
- Hauptordner: /home/timo_hahn/Timos_CC_Projekte/
- Projektordner: /home/timo_hahn/Timos_CC_Projekte/Projects/
- Server IP: 91.99.56.96
- Ports beginnen ab 3000
- Sprache/Framework: Dynamisch je nach Bedarf wählen (React, Vanilla JS, etc.)
  Einfache Apps → Vanilla HTML/JS. Komplexere Apps → React.
  NICHT automatisch React verwenden wenn es nicht nötig ist.
- Kommentare und Ausgaben auf Deutsch
- Prozessmanager: PM2 (alle Apps laufen unter User timo_hahn)
- Reverse Proxy: Caddy (läuft als root, leitet HTTPS an localhost-Ports weiter)
- Datenbank: PostgreSQL 16 (für CC Extension)
- Cache: Redis (für CC Extension)
- Sicherheit: ufw aktiv, nur Ports 22/80/443/8443/9443 offen
- Alle Apps binden an 127.0.0.1 (nur über Caddy erreichbar)

## Projektzuordnung
Bevor du mit einer Änderung oder Erweiterung beginnst, stelle sicher
dass klar ist, welche PWA betroffen ist.

Wenn das nicht eindeutig aus dem Prompt hervorgeht: Frage zuerst nach
welche App geändert werden soll – und warte auf die Antwort, bevor du
anfängst zu arbeiten.

Niemals eine Änderung auf gut Glück in der falschen App durchführen.

## Port-Verwaltung
Neue App = neuer Port (ab 3000 aufsteigend).
Änderung an bestehender App = gleicher Port bleibt.
Bei Änderungen: alte Version stoppen, neue Version auf
demselben Port starten. Niemals für eine Änderung
einen neuen Port vergeben.

## Testing vor Deployment
Bevor der fertige Link zurückgemeldet wird, führe folgende Schritte durch:

1. Prüfe ob die App erfolgreich gebaut wurde (kein Build-Fehler)
2. Starte die App auf dem zugewiesenen Port
3. Prüfe ob der Port tatsächlich erreichbar ist (curl http://91.99.56.96:[port])
4. Prüfe ob die App eine gültige HTML-Antwort zurückgibt
5. Erst wenn alle Checks grün sind: Link zurück in den Chat schicken
6. Wenn ein Check fehlschlägt: Fehler selbstständig beheben und erneut
   prüfen – niemals einen nicht-funktionierenden Link zurückschicken

## Git-Regeln (PFLICHT bei ALLEN Änderungen)

### Vor jeder Änderung
IMMER zuerst einen Backup-Commit erstellen:
```bash
git commit -am "Backup vor [was geplant ist]"
```

### Nach jedem Fix oder Feature
Sofort committen (auch ohne Test durch den Nutzer):
```bash
git commit -am "Fix: [beschreibende deutsche Nachricht]"
# oder
git commit -am "Feature: [beschreibende deutsche Nachricht]"
```

### Wichtige Regeln
- NIEMALS mehr als einen Fix/Feature ohne zwischendurch zu committen
- Bei "funktioniert nicht" oder "mach das rückgängig": `git revert HEAD` (NICHT `git restore`) – so geht nichts verloren
- Bei "funktioniert": Commit als stabil taggen: `git tag stabil-[feature-name]`

### Beispiel-Workflow
```
git commit -am "Backup vor Viewport-Fix"
[Änderungen machen]
git commit -am "Fix: Viewport-Höhe auf iPhone korrigiert"
[Nutzer testet]
→ "funktioniert nicht" → git revert HEAD
→ "funktioniert"       → git tag stabil-viewport-fix
```

## Regeln für neue Projekte/Apps

### Checkliste für neue Apps (Reihenfolge einhalten!)
1. **Port bestimmen:** Nächsten freien Port aus der Port-Übersicht wählen
2. **Ordner erstellen:** ~/Timos_CC_Projekte/Projects/[app-name]/
3. **Technologie wählen:** Einfache App → Vanilla HTML/JS + Express. Komplexe App → React + Express.
4. **App entwickeln:** Mobile-first, Touch-optimiert, PWA-fähig (siehe PWA-Anforderungen)
5. **ecosystem.config.js erstellen:** PM2-Konfiguration mit festem Port und cwd-Pfad
6. **npm install + Build** (falls React)
7. **PM2 starten:** `pm2 start ecosystem.config.js && pm2 save`
8. **Caddy-Eintrag hinzufügen:** HTTPS-Zugang über eigenen Port konfigurieren (siehe Caddy-Regeln)
9. **Testen:** curl + Playwright (siehe Testing-Abschnitte)
10. **Git init:** .gitignore + erster Commit
11. **Port-Übersicht aktualisieren** in dieser CLAUDE.md
12. **Fertigen HTTPS-Link im Chat zurückschicken**

### ecosystem.config.js (PFLICHT für jede App)
Jede App braucht eine ecosystem.config.js im App-Ordner:
```javascript
module.exports = {
  apps: [{
    name: '[app-name]',
    script: 'server.js',
    cwd: '/home/timo_hahn/Timos_CC_Projekte/Projects/[app-name]',
    env: {
      PORT: [zugewiesener-port],
      NODE_ENV: 'production'
    }
  }]
};
```

### PWA-Anforderungen (PFLICHT für jede neue App)
Jede App muss als Progressive Web App funktionieren (zum iPhone-Homescreen hinzufügen):
1. **manifest.json** im public-Ordner mit: name, short_name, icons, start_url, display: "standalone", theme_color, background_color
2. **Service Worker** (sw.js) für Offline-Caching der statischen Assets
3. **Meta-Tags** im HTML-Head:
   ```html
   <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
   <meta name="apple-mobile-web-app-capable" content="yes">
   <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
   <link rel="manifest" href="/manifest.json">
   <link rel="apple-touch-icon" href="/icon-192.png">
   ```
4. **Touch-optimiert:** Mindestens 44x44px Tap-Targets, keine Hover-Abhängigkeiten
5. **Safe Areas beachten:** padding-top: env(safe-area-inset-top) für iPhone-Notch
6. **iOS Input-Zoom verhindern** (in globales CSS):
   ```css
   @supports (-webkit-touch-callout: none) {
     input, textarea, select { font-size: 16px !important; }
   }
   ```
7. **iOS PWA Standalone Viewport-Fix** (im HTML, nach App-Root):
   ```html
   <style>
     @media (display-mode: standalone) {
       html { height: calc(100% + env(safe-area-inset-top)); overflow: hidden; }
       body { position: relative !important; height: 100% !important; }
     }
   </style>
   ```

### Caddy-Regeln (HTTPS für ALLE Apps)
Jede neue App bekommt einen eigenen HTTPS-Eintrag in der Caddyfile.
Der Caddy-Config-Pfad ist: /etc/caddy/Caddyfile (nur als root editierbar)

Format für neue Apps:
```
https://91.99.56.96:[https-port] {
    tls internal
    reverse_proxy localhost:[app-port]
}
```

Caddy danach neu laden: `sudo systemctl reload caddy`

WICHTIG: Den fertigen Link als https://91.99.56.96:[https-port] zurückgeben.

### Ordnerstruktur
1. Jede neue App bekommt einen eigenen Ordner unter ~/Timos_CC_Projekte/Projects/
2. Der Ordnername wird vom User bestimmt oder aus dem App-Namen abgeleitet (z.B. "Meditation" → ~/Timos_CC_Projekte/Projects/meditation/)
3. NIEMALS eine bestehende App überschreiben oder in einen bestehenden Ordner deployen ohne explizite Bestätigung
4. Jede App bekommt einen eigenen Port (3001, 3002, 3003 etc.) — NIEMALS den Port einer bestehenden App verwenden

### Git-Pflicht bei neuen Apps
1. Sobald der erste Wurf einer neuen App steht und funktioniert: Automatisch git init, .gitignore erstellen und ersten Commit machen
2. NICHT warten bis der User danach fragt — das passiert automatisch
3. Commit-Message: "Initial: [App-Name] - [kurze Beschreibung]"
4. Bei jeder weiteren Änderung an der App: Backup-Commit VOR der Änderung, Ergebnis-Commit NACH der Änderung
5. Optional: Remote zu GitHub hinzufügen wenn der User es wünscht

### Deployment-Schutz
1. Bevor eine Änderung an einer bestehenden App deployed wird: Prüfe ob uncommittete Änderungen existieren und committe sie zuerst
2. NIEMALS rm -rf oder ähnliche destruktive Befehle auf App-Ordner ausführen
3. Wenn ein Build fehlschlägt: Den alten Stand NICHT löschen, sondern den Fehler melden und den letzten funktionierenden Stand beibehalten

### Port-Übersicht (aktuell halten!)
| App | Ordner | Port intern | HTTPS-Port (Caddy) | URL |
|-----|--------|-------------|--------------------|----|
| CC Extension | Projects/cc-extension/ | 3000 | 443 | https://91.99.56.96 |
| Meditation | Projects/meditation/ | 3001 | 8443 | https://91.99.56.96:8443 |
| Reha-Tracker | Projects/reha-tracker/ | 3002 | 9443 | https://91.99.56.96:9443 |
| [nächste App] | Projects/ | 3003 | 10443 | |

PM2-Namen: cc-extension-backend, cc-extension-worker, meditation-app, reha-tracker
Aktualisiere diese Liste bei jeder neuen App.

## Ordnerstruktur (WICHTIG – NICHT duplizieren!)
Alle Apps liegen unter ~/Timos_CC_Projekte/Projects/:
```
~/Timos_CC_Projekte/
├── CLAUDE.md              ← Globale Regeln
├── scripts/               ← Deploy + Backup
├── backups/               ← DB-Dumps
└── Projects/
    ├── cc-extension/      ← Port 3000 (eigene CLAUDE.md)
    ├── meditation/        ← Port 3001 (eigene CLAUDE.md)
    └── reha-tracker/      ← Port 3002 (eigene CLAUDE.md)
```
Es gibt KEINE Unterordner wie deployments/ oder hetzner/.
NIEMALS eine bestehende App in einen neuen Ordner kopieren oder
duplizieren. Änderungen immer im bestehenden App-Ordner durchführen.

## Testing mit Playwright
Playwright (v1.58.2) ist installiert mit Chromium-Browser.
Nach dem Build führe automatisierte Tests durch:

1. **curl-Schnelltest:** `curl -s -o /dev/null -w "%{http_code}" http://localhost:[port]` → muss 200 sein
2. **Playwright-Test:** Rufe die App unter https://91.99.56.96:[port] auf
3. Simuliere iPhone-Bildschirmgröße (390x844)
4. Prüfe ob die App lädt ohne JavaScript-Fehler
5. Klicke alle sichtbaren Buttons und prüfe ob eine Reaktion erfolgt
6. Nur wenn alle Tests grün: Link zurückschicken
7. Bei Fehler: selbstständig beheben und erneut testen
