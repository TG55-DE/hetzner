# Bomberman – Architektur-Dokumentation

## Übersicht

Bomberman ist ein Echtzeit-Multiplayer-Spiel mit **autoritativem Server**. Das bedeutet:
- Der **Server ist die einzige Wahrheit** (führt alle Spiellogik aus)
- Die **Clients sind reine Darstellung** (rendern den Server-State, senden nur Inputs)

```
iPhone/Browser A          Server (Node.js)          iPhone/Browser B
     │                         │                         │
     │── Input (dir, bomb) ──> │                         │
     │                         │── Spiellogik (Tick) ─── │
     │ <─── game_state ────── │── game_state ─────────> │
     │                         │                         │
     │       Rendering         │       Rendering         │
```

---

## Dateistruktur

```
bomberman/
├── server/
│   ├── constants.js      # Spielkonstanten (TILE, COLS, ROWS, etc.)
│   ├── gameLogic.js      # Pure Logik-Funktionen (kein State, kein IO)
│   ├── gameRoom.js       # GameRoom-Klasse (Zustand + 20-TPS-Spielschleife)
│   └── roomManager.js    # Registry aller aktiven Räume
├── public/
│   ├── game.js           # Renderer + Input-Manager + BombermanGame-Koordinator
│   ├── client.js         # Socket.io Client (Verbindung, State-Empfang)
│   ├── index.html        # UI: Hauptmenü + Lobby + Join-Overlays
│   ├── manifest.json     # PWA-Manifest
│   └── sw.js             # Service Worker
├── server.js             # Express + Socket.io + HTTP-Routing
├── ARCHITECTURE.md       # Diese Datei
└── ecosystem.config.js   # PM2-Konfiguration
```

---

## Server-Schicht

### server/constants.js
Alle Spielkonstanten. Werden auch in `public/game.js` gespiegelt (der Browser hat keinen require-Zugriff).

**Wichtig bei Änderungen:** Konstanten in beiden Dateien synchron halten.

### server/gameLogic.js
**Pure Funktionen** – kein State, kein IO, kein `this`.

| Funktion | Beschreibung |
|----------|-------------|
| `generateMap()` | Neues Spielfeld generieren |
| `canMove(nx, ny, map, bombs)` | Bewegbarkeit prüfen |
| `updatePlayer(player, dt, input, map, bombs)` | Spieler-State für einen Tick updaten |
| `updateEnemy(enemy, dt, map, bombs, expl, players)` | KI-Gegner für einen Tick updaten |
| `explodeBomb(bomb, map, powerups, chance)` | Explosion berechnen, Map mutieren |
| `checkCollisions(players, enemies, expl, pups, scores)` | Kollisionen prüfen, Events zurückgeben |
| `createPlayerState(socketId, slot)` | Neuen Spieler-State erstellen |
| `createEnemyState(id, gx, gy)` | Neuen KI-Gegner-State erstellen |

**Neue Features hier hinzufügen**: neue Power-ups, neue Spielmechaniken, etc.

### server/gameRoom.js
**GameRoom-Klasse** – verwaltet einen laufenden Spielraum.

- Hält den vollständigen Spielzustand (Map, Spieler, Bomben, Explosionen, Power-ups)
- Läuft mit `setInterval` bei 20 TPS (Ticks pro Sekunde)
- Broadcastet nach jedem Tick einen State-Snapshot per `onBroadcast`-Callback
- Map wird nur bei Änderung mitgesendet (Bandbreiten-Optimierung, `_mapDirty`-Flag)

**Spieler-Slots:**
- Slot 0 (Host): oben links (1,1) – blau
- Slot 1: oben rechts – grün
- Slot 2: unten links – orange
- Slot 3: unten rechts – lila

**KI-Gegner** füllen die Welt mit `WORLD_ENEMIES[worldIdx]` Gegnern (3/4/5).

### server/roomManager.js
**Room-Registry** – verwaltet alle aktiven Räume.

- `createRoom(socketId, settings)` → erstellt neuen Raum mit 4-Buchstaben-Code
- `joinRoom(code, socketId)` → Spieler einem Raum hinzufügen
- `removePlayer(socketId)` → Spieler entfernen, leere Räume aufräumen
- `getRoomBySocket(socketId)` → Raum eines Sockets finden

### server.js
**Express + Socket.io** – HTTP-Routing und WebSocket-Events.

**Socket-Events Client→Server:**
| Event | Payload | Beschreibung |
|-------|---------|-------------|
| `create_room` | `{ worldIdx, speed, collectibles }` | Neuen Raum erstellen |
| `join_room` | `{ code }` | Raum beitreten |
| `start_game` | – | Spiel starten (nur Host) |
| `input` | `{ dir, bomb }` | Spieler-Input senden |
| `update_settings` | `{ worldIdx?, speed?, collectibles? }` | Einstellungen ändern (nur Host) |

**Socket-Events Server→Client:**
| Event | Payload | Beschreibung |
|-------|---------|-------------|
| `room_created` | `{ code }` | Raum wurde erstellt |
| `room_joined` | `{ code }` | Raum beigetreten |
| `join_error` | `string` | Fehler beim Beitreten |
| `lobby_state` | `{ phase, code, hostId, players }` | Lobby aktualisiert |
| `game_started` | – | Spiel beginnt |
| `game_state` | Snapshot (siehe unten) | Game-State pro Tick |
| `play_audio` | `string` | Audio-Event auslösen |
| `player_left` | `{ id }` | Spieler getrennt |

**HTTP-Endpunkte:**
- `GET /api/qr/:code` → QR-Code als Data-URL (goldfarbig auf dunklem Hintergrund)

---

## Client-Schicht

### public/client.js
**BombermanClient** – Socket.io-Verbindung und Event-Handling.

- Verbindet sich bei `start()` automatisch
- Erkennt `/join/CODE`-URLs und tritt dem Raum automatisch bei
- Sendet Input-Events pro Render-Frame (60fps)

### public/game.js
**BombermanGame** – Koordinator (Renderer + Input + Client).

Wichtigste Methoden:
- `applyServerState(state)` – Server-State empfangen und cachen
- `render()` – Canvas mit aktuellem State rendern
- `loop(ts)` – Render-Loop (requestAnimationFrame), sendet auch Input

**Renderer-Klasse** (`drawPlayer`, `drawEnemy`, etc.) – unverändert zur Spiellogik.

**InputManager** – lokaler Input (Keyboard, Touch, Joystick). Wird per Socket gesendet.

---

## State-Snapshot-Format

Der Server sendet pro Tick (20x/s) folgenden Snapshot:

```js
{
  phase: 'lobby' | 'play' | 'clear' | 'over' | 'win',
  worldIdx: 0 | 1 | 2,
  code: 'ABCD',
  hostId: 'socket-id',
  map: number[][] | null,   // null wenn unverändert
  players: [{
    id, slot, px, py, gridX, gridY, targetX, targetY,
    lives, alive, invTimer, facing, animT,
    bombsOut, maxBombs, range, speed
  }],
  enemies: [{ id, px, py, gridX, gridY, alive, animT }],
  bombs: [{ gx, gy, timer }],
  explosions: [{ tiles, timer, cx, cy }],
  powerups: [{ gx, gy, type }],
  scores: { [socketId]: number }
}
```

---

## Neue Features hinzufügen

### Neue Power-up-Typen
1. Konstante in `server/constants.js` hinzufügen (z.B. `PU_SHIELD = 'sh'`)
2. Logik in `server/gameLogic.js` → `explodeBomb()` (Spawn) und `checkCollisions()` (Aufsammeln)
3. Anwendung in `server/gameRoom.js` → `_handlePowerup()`
4. Rendering in `public/game.js` → `Renderer.drawPowerups()`

### Neue Spielmechaniken (z.B. Wände schieben)
1. Logik-Funktion in `server/gameLogic.js` (pure function)
2. Aufrufen in `server/gameRoom.js` → `_tick()`
3. State ggf. im Snapshot ergänzen
4. Client rendert automatisch wenn State stimmt

### Mehr Welten
1. World-Config in `public/game.js` → `WORLDS`-Array erweitern
2. `WORLD_ENEMIES` in `server/constants.js` anpassen
3. Welt-Auswahl-Buttons in `index.html` hinzufügen

---

## Multiplayer-Flow

```
Host öffnet App
  → "Multiplayer erstellen" tippen
  → Server erstellt Raum (4-Buchstaben-Code + QR-Code)
  → Lobby zeigt QR + Spieler-Slots
  → Freund scannt QR → landet auf /join/XXXX
  → Automatisch dem Raum beigetreten
  → Lobby aktualisiert sich (Slot 2 besetzt)
  → Host tippt "Spiel starten"
  → Leere Slots = KI-Gegner (3/4/5 je nach Welt)
  → Spiel beginnt für alle gleichzeitig
```

---

## Performance-Überlegungen

- **20 TPS** reicht für Grid-basiertes Bomberman (Bewegung ist kachelbasiert, nicht pixelgenau)
- **Map-Delta**: Map wird nur gesendet wenn Bricks zerstört wurden (`_mapDirty`)
- **Input-Throttle**: Client sendet Input bei 60fps, Server verarbeitet bei 20fps (kein Problem)
- **Tick-Größe**: 4 Spieler + 5 KI-Gegner + ~20 Bomben/Explosionen = unter 5KB pro Tick

---

## Technologien

| Komponente | Technologie | Version |
|-----------|-------------|---------|
| Server | Node.js + Express | 18.x |
| WebSockets | Socket.io | ^4 |
| QR-Code | qrcode | ^1 |
| Client | Vanilla JS | ES2020 |
| Prozessmanager | PM2 | – |
| Reverse Proxy | Caddy | – |
